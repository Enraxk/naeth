<script lang="ts">
  import { iconSvg } from '../lib/icons'
  let { name, size = 14, color = 'currentColor' }: { name: string; size?: number; color?: string } = $props()
</script>

{@html iconSvg(name, size, color)}
