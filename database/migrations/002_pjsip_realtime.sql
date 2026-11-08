-- tables read (and for ps_contacts, written) by asterisk through odbc.
-- column names must stay exactly as asterisk expects them, do not rename.
-- yes/no options are stored as plain 'yes' / 'no' strings.

create table ps_aors (
   id                   varchar(255) primary key,
   max_contacts         integer,
   remove_existing      varchar(3),
   default_expiration   integer,
   minimum_expiration   integer,
   maximum_expiration   integer,
   qualify_frequency    integer,
   qualify_timeout      double precision,
   authenticate_qualify varchar(3),
   support_path         varchar(3),
   remove_unavailable   varchar(3),
   mailboxes            varchar(80),
   voicemail_extension  varchar(40),
   outbound_proxy       varchar(256),
   contact              varchar(255)
);

create table ps_auths (
   id             varchar(255) primary key,
   auth_type      varchar(10),
   username       varchar(40),
   password       varchar(80),
   md5_cred       varchar(40),
   realm          varchar(40),
   nonce_lifetime integer
);

create table ps_endpoints (
   id                   varchar(255) primary key,
   transport            varchar(40),
   aors                 varchar(2048),
   auth                 varchar(255),
   context              varchar(40),
   disallow             varchar(200),
   allow                varchar(200),
   direct_media         varchar(3),
   dtmf_mode            varchar(20),
   force_rport          varchar(3),
   rewrite_contact      varchar(3),
   rtp_symmetric        varchar(3),
   ice_support          varchar(3),
   callerid             varchar(80),
   mailboxes            varchar(80),
   language             varchar(10),
   identify_by          varchar(80),
   device_state_busy_at integer,
   named_call_group     varchar(40),
   named_pickup_group   varchar(40),
   allow_subscribe      varchar(3),
   subscribe_context    varchar(40),
   message_context      varchar(40),
   rtp_timeout          integer,
   rtp_timeout_hold     integer
);

-- filled by asterisk itself when a phone registers
create table ps_contacts (
   id                   varchar(255) primary key,
   uri                  varchar(511),
   expiration_time      bigint,
   qualify_frequency    integer,
   outbound_proxy       varchar(256),
   path                 text,
   user_agent           varchar(255),
   qualify_timeout      double precision,
   reg_server           varchar(255),
   authenticate_qualify varchar(3),
   via_addr             varchar(40),
   via_port             integer,
   call_id              varchar(255),
   endpoint             varchar(40),
   prune_on_boot        varchar(3)
);

create index ps_contacts_endpoint_idx on
   ps_contacts (
      endpoint
   );