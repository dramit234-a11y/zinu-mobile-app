-- Runs once when the local Postgres volume is first created.
CREATE DATABASE zinu_test OWNER zinu;
\c zinu
CREATE EXTENSION IF NOT EXISTS postgis;
\c zinu_test
CREATE EXTENSION IF NOT EXISTS postgis;
