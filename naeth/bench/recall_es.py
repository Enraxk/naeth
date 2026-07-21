"""Evaluacion de la CALIDAD del recall semantico en espanol (Paso 7 Fase 2: "evaluar
bge-m3 / el modelo en espanol"). Distinto del bench HNSW (que midio el indice vs exacto):
aqui medimos si el MODELO entiende el espanol, comparando los multilingues de fastembed.

Metodo: corpus de N "memorias" en espanol (estilo Naeth: proyectos, decisiones, infra) +
una query parafraseada por documento, con MINIMO solapamiento lexico (sinonimos y
reformulacion), para que recuperar dependa del significado y no de palabras compartidas.
Para cada modelo: embeber docs y queries, rankear por coseno, medir recall@1/3/5 y MRR.

Modelos comparados (todos en fastembed 0.5.1; bge-m3 NO esta disponible alli):
  - paraphrase-multilingual-MiniLM-L12-v2  (384, el ACTUAL de la pila)
  - paraphrase-multilingual-mpnet-base-v2  (768)
  - intfloat/multilingual-e5-large         (1024, prefijos query/passage)

Uso (host):  uv run --with fastembed --with numpy python bench/recall_es.py
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np

# (documento, query parafraseada). La query evita repetir el lexico del doc a proposito.
PAIRS = [
    ("Naeth guarda las memorias en Postgres con la extension pgvector y un indice HNSW para la busqueda por similitud.",
     "Que motor de base de datos y que estructura de indexado usa el sistema para encontrar vectores parecidos?"),
    ("El worker genera los embeddings en la CPU de forma asincrona, drenando una cola de trabajos.",
     "Como se calculan los vectores de las notas sin bloquear la escritura, y donde se procesan?"),
    ("La politica ADD-only impide destruir informacion: editar crea una version nueva y borrar deja una lapida.",
     "De que manera evita el sistema perder datos cuando modificas o quitas una entrada?"),
    ("El home server finally se cae con los cortes de luz, por eso el diseno es multi-master local primero.",
     "Por que motivo se eligio una topologia de dos nodos que reconcilian en lugar de un servidor unico?"),
    ("claude.ai exige OAuth 2.1 con PKCE y registro dinamico de cliente para conectar un conector remoto.",
     "Que requisitos de autenticacion impone la web de Anthropic para enlazar un servicio externo por MCP?"),
    ("El tunel de Cloudflare publica el equipo de casa en internet sin abrir puertos ni exponer la IP.",
     "Como se hace accesible desde fuera la maquina domestica sin tocar el router ni revelar su direccion?"),
    ("La busqueda hibrida fusiona resultados semanticos y lexicos con Reciprocal Rank Fusion en una sola consulta.",
     "De que forma combina el sistema el parecido de significado con la coincidencia de palabras al consultar?"),
    ("Los embeddings son por-nodo y no se sincronizan: cada maquina regenera los suyos con su propio modelo.",
     "Por que los vectores no viajan entre las dos instancias y cada una los vuelve a calcular?"),
    ("El visor web se queda solo en localhost; nunca se expone por el tunel hacia el exterior.",
     "Por que la interfaz de gestion solo es accesible desde el propio equipo y no desde la red publica?"),
    ("El modelo de embeddings y su dimension son configurables por variable de entorno en cada despliegue.",
     "Como se ajusta que red neuronal de vectorizacion y que tamano usa cada instalacion?"),
    ("Gridwatch monitoriza la red electrica y modela los activos con el estandar CIM sobre un bus de eventos.",
     "Que proyecto vigila el sistema de energia y con que norma representa los componentes de la malla?"),
    ("El despliegue final sera en un Ryzen con poca VRAM, asi que Naeth funciona sin necesidad de un modelo grande de lenguaje.",
     "Por que la arquitectura prescinde de un LLM pesado dada la limitacion de memoria de video del hardware destino?"),
    ("Cada decision importante se registra como memoria de tipo decision, enlazada a las que la originaron.",
     "Como se deja constancia de las elecciones de diseno y se conecta con sus antecedentes?"),
    ("El login de un solo usuario valida usuario y contrasena antes de emitir el codigo de autorizacion.",
     "Que comprobacion de identidad ocurre antes de entregar las credenciales de acceso?"),
    ("Los adjuntos binarios viven en disco fuera de la base de datos y se replican por su hash sha256.",
     "Donde se almacenan los ficheros pesados y como se copian entre nodos evitando duplicados?"),
    ("El path organiza las memorias por proyecto y origen en dos niveles, sin incluir la fecha.",
     "Como se estructura la jerarquia de carpetas logicas y por que no lleva el dia en la ruta?"),
    ("La cola de trabajos da observabilidad y reintentos, y el desfase se mide como tiempo entre encolar y terminar.",
     "Que ventajas aporta el sistema de tareas pendientes y como se cuantifica su retraso?"),
    ("El vault de Obsidian quedo abandonado y ya no es la referencia; Naeth lo reemplaza como origen de la verdad.",
     "Que herramienta de notas dejo de usarse y que la sustituye como fuente canonica?"),
    ("Las relaciones del grafo expresan dependencias y derivaciones que la jerarquia de carpetas no puede capturar.",
     "Para que sirven las aristas entre nodos cuando el arbol de rutas se queda corto?"),
    ("Mover la imagen de disco de Docker al SSD secundario libera espacio en el disco del sistema operativo.",
     "Que se gana trasladando el almacenamiento de los contenedores a la otra unidad de estado solido?"),
    ("Yogin es una pagina de aterrizaje para captar usuarios interesados en el producto.",
     "Que proyecto consiste en una web de presentacion para atraer clientes potenciales?"),
    ("El indice HNSW solo cubre lo vigente y ya vectorizado, usando una bandera cacheada localmente.",
     "Sobre que subconjunto de filas opera el indice de similitud y de que depende su filtro?"),
    ("La sincronizacion entre nodos es una union de filas inmutables identificadas por UUID, sin resolver conflictos in situ.",
     "Como se concilian dos instancias sin sobrescribir cambios, aprovechando identificadores unicos?"),
    ("El servicio de Cloudflare arranca al encender el equipo, antes incluso de iniciar sesion.",
     "En que momento del arranque se levanta el conector de red, respecto al inicio de usuario?"),
    ("Naeth nace como sistema de memoria portable para que el contexto viaje entre distintas herramientas de IA.",
     "Cual es el proposito de fondo: que la informacion persistente sirva en varios asistentes a la vez?"),
]

MODELS = [
    ("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2", "none", 384),
    ("sentence-transformers/paraphrase-multilingual-mpnet-base-v2", "none", 768),
    ("intfloat/multilingual-e5-large", "e5", 1024),
]


def embed(model_name, prefix, texts, kind):
    from fastembed import TextEmbedding
    if prefix == "e5":
        tag = "query: " if kind == "query" else "passage: "
        texts = [tag + t for t in texts]
    m = TextEmbedding(model_name=model_name)
    return np.array([v for v in m.embed(texts)], dtype="float32")


def evaluate(docs, queries):
    results = []
    for name, prefix, dim in MODELS:
        t0 = time.perf_counter()
        D = embed(name, prefix, docs, "passage")
        Q = embed(name, prefix, queries, "query")
        dt = time.perf_counter() - t0
        # normalizar y coseno
        D /= np.linalg.norm(D, axis=1, keepdims=True)
        Q /= np.linalg.norm(Q, axis=1, keepdims=True)
        sims = Q @ D.T  # (nq, nd)
        ranks = []
        for i in range(len(queries)):
            order = np.argsort(-sims[i])  # docs por similitud desc
            rank = int(np.where(order == i)[0][0]) + 1  # el doc relevante es el i-esimo
            ranks.append(rank)
        ranks = np.array(ranks)
        row = {
            "model": name.split("/")[-1], "dim": dim,
            "recall@1": round(float((ranks <= 1).mean()), 3),
            "recall@3": round(float((ranks <= 3).mean()), 3),
            "recall@5": round(float((ranks <= 5).mean()), 3),
            "mrr": round(float((1.0 / ranks).mean()), 3),
            "embed_s": round(dt, 1),
        }
        results.append(row)
        print(f"[recall-es] {row['model']:<45} d={dim:<4} "
              f"R@1={row['recall@1']:.3f} R@3={row['recall@3']:.3f} "
              f"R@5={row['recall@5']:.3f} MRR={row['mrr']:.3f} ({dt:.1f}s)", flush=True)
    return results


def main():
    docs = [d for d, _ in PAIRS]
    queries = [q for _, q in PAIRS]
    print(f"[recall-es] {len(PAIRS)} pares doc/query parafraseada en espanol\n", flush=True)
    results = evaluate(docs, queries)
    out = {"n_pairs": len(PAIRS), "results": results}
    Path("recall_es.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n[recall-es] -> recall_es.json", flush=True)


if __name__ == "__main__":
    main()
