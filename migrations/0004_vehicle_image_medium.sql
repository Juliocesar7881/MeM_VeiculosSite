-- Versão média das fotos (~1080 px) para celulares: reduz o LCP sem sacrificar nitidez.
-- Nula em fotos antigas/convertidas de propostas (o site usa miniatura/grande nesses casos).
ALTER TABLE vehicle_images ADD COLUMN medium_key TEXT;
ALTER TABLE vehicle_images ADD COLUMN medium_width INTEGER;
ALTER TABLE vehicle_images ADD COLUMN medium_height INTEGER;
