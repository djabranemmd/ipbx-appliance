-- management layer: web admins, audit trail, numbering plan, people, extensions

CREATE TABLE admins (
    id            serial PRIMARY KEY,
    username      varchar(50)  NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL,
    full_name     varchar(100) NOT NULL,
    role          varchar(20)  NOT NULL DEFAULT 'operator'
                  CHECK (role IN ('admin', 'operator', 'viewer')),
    active        boolean      NOT NULL DEFAULT true,
    last_login_at timestamptz,
    created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
    id         bigserial PRIMARY KEY,
    admin_id   integer REFERENCES admins (id) ON DELETE SET NULL,
    username   varchar(50),
    action     varchar(60) NOT NULL,
    target     varchar(120),
    details    jsonb,
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);

-- numbering plan: each service owns a block of extension numbers
CREATE TABLE dial_ranges (
    id          serial PRIMARY KEY,
    name        varchar(60) NOT NULL UNIQUE,
    range_start integer NOT NULL,
    range_end   integer NOT NULL,
    CHECK (range_start > 0 AND range_end >= range_start),
    -- two ranges can never overlap
    EXCLUDE USING gist (int4range(range_start, range_end, '[]') WITH &&)
);

CREATE TABLE users (
    id         serial PRIMARY KEY,
    first_name varchar(60)  NOT NULL,
    last_name  varchar(60)  NOT NULL,
    email      varchar(120) UNIQUE,
    created_at timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE extensions (
    id              serial PRIMARY KEY,
    number          varchar(10) NOT NULL UNIQUE CHECK (number ~ '^[0-9]{2,10}$'),
    user_id         integer UNIQUE REFERENCES users (id) ON DELETE SET NULL,
    display_name    varchar(80) NOT NULL,
    enabled         boolean     NOT NULL DEFAULT true,
    -- 'internal' = can only call other extensions, 'external' = can also use trunks
    call_permission varchar(10) NOT NULL DEFAULT 'internal'
                    CHECK (call_permission IN ('internal', 'external')),
    created_at      timestamptz NOT NULL DEFAULT now()
);