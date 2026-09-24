-- Métricas anônimas por veículo e por dia (fuso de Brasília): visualizações da página e cliques
-- nos botões de WhatsApp. Sem cookies, sem IP e sem nenhum dado do visitante — só contadores.
CREATE TABLE vehicle_daily_stats (
  vehicle_id TEXT NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  whatsapp_clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (vehicle_id, day)
);

CREATE INDEX idx_vehicle_daily_stats_day ON vehicle_daily_stats (day);
