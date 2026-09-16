<!-- Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
     No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE -->
<script lang="ts">
  import { iconSvg } from '../lib/icons'
  let { name, size = 14, color = 'currentColor' }: { name: string; size?: number; color?: string } = $props()
</script>

{@html iconSvg(name, size, color)}
