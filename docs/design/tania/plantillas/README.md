# Plantillas de las seis caras del libro (Naeth, 182 páginas)

Cada PNG tiene el tamaño exacto de una cara a escala 2 (en pantalla es la mitad). Son transparentes
con un marco azul y el nombre: se pinta encima y se entrega con el mismo tamaño, sin el marco.

| Cara | px | Qué es |
|---|---:|---|
| tapa, contratapa | 1120 × 1520 | la tela; la tapa lleva el lockup centrado (lo ponemos nosotros) |
| lomo | 104 × 1520 | la tela un tono más oscura; el nombre en vertical lo ponemos nosotros |
| canto | 104 × 1494 | las hojas vistas de canto (líneas finas) |
| cabeza, pie | 1088 × 104 | las hojas vistas desde arriba y desde abajo |

El grosor (104 = 2 × 52) es el de Naeth: `6 + 0,25 × 182`. Para otro libro cambia solo el ancho del
lomo, del canto, y el alto de cabeza y pie. Si la tela y el canto se entregan como **teselas
repetibles** (2048 px), estas plantillas no hacen falta: las caras se componen en CSS.
