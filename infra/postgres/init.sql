-- Creates per-service databases on first container boot.
-- Safe to re-run: each CREATE is idempotent through a DO block.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'auth_db') THEN
    CREATE DATABASE auth_db;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'catalog_db') THEN
    CREATE DATABASE catalog_db;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'order_db') THEN
    CREATE DATABASE order_db;
  END IF;
END
$$;
