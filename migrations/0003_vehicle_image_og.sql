-- Imagem de compartilhamento (Open Graph, JPEG 1200x630) gerada no navegador durante o upload.
-- Necessária no Cloudflare Workers, que não roda sharp. Nula para fotos antigas/convertidas de propostas.
ALTER TABLE vehicle_images ADD COLUMN og_key TEXT;
