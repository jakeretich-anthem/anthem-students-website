-- roster_students replaced this read-mirror of the Google Sheet (see
-- 20261026183013_roster_students_source_of_truth.sql). Nothing reads or
-- writes it since that deploy.
drop table if exists roster_cache;
