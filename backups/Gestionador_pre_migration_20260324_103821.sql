--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categorias_inventario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorias_inventario (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL
);


ALTER TABLE public.categorias_inventario OWNER TO postgres;

--
-- Name: categorias_inventario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categorias_inventario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categorias_inventario_id_seq OWNER TO postgres;

--
-- Name: categorias_inventario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorias_inventario_id_seq OWNED BY public.categorias_inventario.id;


--
-- Name: categorias_transaccion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorias_transaccion (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo character varying(10) NOT NULL,
    CONSTRAINT categorias_transaccion_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['income'::character varying, 'expense'::character varying])::text[])))
);


ALTER TABLE public.categorias_transaccion OWNER TO postgres;

--
-- Name: categorias_transaccion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categorias_transaccion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categorias_transaccion_id_seq OWNER TO postgres;

--
-- Name: categorias_transaccion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorias_transaccion_id_seq OWNED BY public.categorias_transaccion.id;


--
-- Name: chat_mensajes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_mensajes (
    id integer NOT NULL,
    chat_id uuid NOT NULL,
    contenido text NOT NULL,
    remitente character varying(10) NOT NULL,
    leido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_mensajes_remitente_check CHECK (((remitente)::text = ANY ((ARRAY['user'::character varying, 'bot'::character varying, 'agent'::character varying])::text[])))
);


ALTER TABLE public.chat_mensajes OWNER TO postgres;

--
-- Name: chat_mensajes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_mensajes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_mensajes_id_seq OWNER TO postgres;

--
-- Name: chat_mensajes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_mensajes_id_seq OWNED BY public.chat_mensajes.id;


--
-- Name: chats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id integer NOT NULL,
    contacto_id uuid NOT NULL,
    estado character varying(20) DEFAULT 'open'::character varying NOT NULL,
    no_leidos integer DEFAULT 0 NOT NULL,
    ultimo_mensaje text,
    ultima_actividad timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chats_estado_check CHECK (((estado)::text = ANY ((ARRAY['open'::character varying, 'resolved'::character varying, 'pending'::character varying])::text[]))),
    CONSTRAINT chats_no_leidos_check CHECK ((no_leidos >= 0))
);


ALTER TABLE public.chats OWNER TO postgres;

--
-- Name: configuracion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracion (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    clave character varying(100) NOT NULL,
    valor text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.configuracion OWNER TO postgres;

--
-- Name: configuracion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.configuracion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.configuracion_id_seq OWNER TO postgres;

--
-- Name: configuracion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.configuracion_id_seq OWNED BY public.configuracion.id;


--
-- Name: contactos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contactos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    telefono character varying(30),
    email character varying(255),
    canal character varying(20) DEFAULT 'whatsapp'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contactos_canal_check CHECK (((canal)::text = ANY ((ARRAY['whatsapp'::character varying, 'messenger'::character varying, 'telegram'::character varying, 'otro'::character varying])::text[])))
);


ALTER TABLE public.contactos OWNER TO postgres;

--
-- Name: cuentas_bancarias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cuentas_bancarias (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    banco character varying(255),
    numero_cuenta character varying(50),
    moneda_codigo character(3) DEFAULT 'USD'::bpchar NOT NULL,
    saldo_actual numeric(15,2) DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cuentas_bancarias OWNER TO postgres;

--
-- Name: cuentas_bancarias_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cuentas_bancarias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cuentas_bancarias_id_seq OWNER TO postgres;

--
-- Name: cuentas_bancarias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cuentas_bancarias_id_seq OWNED BY public.cuentas_bancarias.id;


--
-- Name: empresa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.empresa (
    id integer NOT NULL,
    nombre character varying(255) DEFAULT 'MicroEmpresa S.A.'::character varying NOT NULL,
    moneda_codigo character(3) DEFAULT 'USD'::bpchar NOT NULL,
    logo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.empresa OWNER TO postgres;

--
-- Name: empresa_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.empresa_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.empresa_id_seq OWNER TO postgres;

--
-- Name: empresa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.empresa_id_seq OWNED BY public.empresa.id;


--
-- Name: extractos_bancarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.extractos_bancarios (
    id integer NOT NULL,
    cuenta_id integer NOT NULL,
    fecha date NOT NULL,
    descripcion text NOT NULL,
    monto numeric(15,2) NOT NULL,
    referencia_banco character varying(100),
    conciliado boolean DEFAULT false NOT NULL,
    transaccion_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.extractos_bancarios OWNER TO postgres;

--
-- Name: extractos_bancarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.extractos_bancarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.extractos_bancarios_id_seq OWNER TO postgres;

--
-- Name: extractos_bancarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.extractos_bancarios_id_seq OWNED BY public.extractos_bancarios.id;


--
-- Name: flujos_mensajes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flujos_mensajes (
    id integer NOT NULL,
    flujo_id character varying(50) NOT NULL,
    contenido text NOT NULL,
    orden integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.flujos_mensajes OWNER TO postgres;

--
-- Name: flujos_mensajes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.flujos_mensajes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.flujos_mensajes_id_seq OWNER TO postgres;

--
-- Name: flujos_mensajes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.flujos_mensajes_id_seq OWNED BY public.flujos_mensajes.id;


--
-- Name: flujos_opciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flujos_opciones (
    id character varying(50) NOT NULL,
    flujo_id character varying(50) NOT NULL,
    trigger_key character varying(20) NOT NULL,
    etiqueta character varying(255) NOT NULL,
    siguiente_flujo character varying(50),
    orden integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.flujos_opciones OWNER TO postgres;

--
-- Name: flujos_webhook; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flujos_webhook (
    id character varying(50) NOT NULL,
    empresa_id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    trigger_keys text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.flujos_webhook OWNER TO postgres;

--
-- Name: inventario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id integer NOT NULL,
    sku character varying(50) NOT NULL,
    nombre character varying(255) NOT NULL,
    stock numeric(15,3) DEFAULT 0 NOT NULL,
    min_warning numeric(15,3) DEFAULT 0 NOT NULL,
    precio numeric(15,2) DEFAULT 0 NOT NULL,
    categoria_id integer,
    imagen_url text,
    tipo_item character varying(10) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventario_min_warning_check CHECK ((min_warning >= (0)::numeric)),
    CONSTRAINT inventario_precio_check CHECK ((precio >= (0)::numeric)),
    CONSTRAINT inventario_stock_check CHECK ((stock >= (0)::numeric)),
    CONSTRAINT inventario_tipo_item_check CHECK (((tipo_item)::text = ANY ((ARRAY['product'::character varying, 'insumo'::character varying])::text[])))
);


ALTER TABLE public.inventario OWNER TO postgres;

--
-- Name: kardex; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kardex (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    item_id uuid NOT NULL,
    usuario_id integer,
    tipo_movimiento character varying(30) NOT NULL,
    cantidad numeric(15,3) NOT NULL,
    stock_anterior numeric(15,3) NOT NULL,
    stock_nuevo numeric(15,3) NOT NULL,
    referencia_id text,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kardex_tipo_movimiento_check CHECK (((tipo_movimiento)::text = ANY ((ARRAY['entrada'::character varying, 'salida'::character varying, 'ajuste'::character varying, 'produccion_entrada'::character varying, 'produccion_salida'::character varying])::text[])))
);


ALTER TABLE public.kardex OWNER TO postgres;

--
-- Name: kardex_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.kardex_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kardex_id_seq OWNER TO postgres;

--
-- Name: kardex_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.kardex_id_seq OWNED BY public.kardex.id;


--
-- Name: monedas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monedas (
    codigo character(3) NOT NULL,
    nombre character varying(100) NOT NULL,
    simbolo character varying(5) NOT NULL
);


ALTER TABLE public.monedas OWNER TO postgres;

--
-- Name: produccion_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produccion_log (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    producto_id uuid NOT NULL,
    usuario_id integer,
    cantidad numeric(15,3) NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT produccion_log_cantidad_check CHECK ((cantidad > (0)::numeric))
);


ALTER TABLE public.produccion_log OWNER TO postgres;

--
-- Name: produccion_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.produccion_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.produccion_log_id_seq OWNER TO postgres;

--
-- Name: produccion_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.produccion_log_id_seq OWNED BY public.produccion_log.id;


--
-- Name: receta_ingredientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.receta_ingredientes (
    id integer NOT NULL,
    receta_id integer NOT NULL,
    insumo_id uuid NOT NULL,
    cantidad numeric(15,3) NOT NULL,
    CONSTRAINT receta_ingredientes_cantidad_check CHECK ((cantidad > (0)::numeric))
);


ALTER TABLE public.receta_ingredientes OWNER TO postgres;

--
-- Name: receta_ingredientes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.receta_ingredientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.receta_ingredientes_id_seq OWNER TO postgres;

--
-- Name: receta_ingredientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.receta_ingredientes_id_seq OWNED BY public.receta_ingredientes.id;


--
-- Name: recetas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recetas (
    id integer NOT NULL,
    producto_id uuid NOT NULL
);


ALTER TABLE public.recetas OWNER TO postgres;

--
-- Name: recetas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.recetas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recetas_id_seq OWNER TO postgres;

--
-- Name: recetas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recetas_id_seq OWNED BY public.recetas.id;


--
-- Name: transacciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transacciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id integer NOT NULL,
    usuario_id integer,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    descripcion text NOT NULL,
    monto numeric(15,2) NOT NULL,
    tipo character varying(10) NOT NULL,
    categoria_id integer NOT NULL,
    estado character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transacciones_estado_check CHECK (((estado)::text = ANY ((ARRAY['completed'::character varying, 'pending'::character varying, 'overdue'::character varying])::text[]))),
    CONSTRAINT transacciones_monto_check CHECK ((monto > (0)::numeric)),
    CONSTRAINT transacciones_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['income'::character varying, 'expense'::character varying])::text[])))
);


ALTER TABLE public.transacciones OWNER TO postgres;

--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    avatar_url text,
    rol character varying(50) DEFAULT 'admin'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: categorias_inventario id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_inventario ALTER COLUMN id SET DEFAULT nextval('public.categorias_inventario_id_seq'::regclass);


--
-- Name: categorias_transaccion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_transaccion ALTER COLUMN id SET DEFAULT nextval('public.categorias_transaccion_id_seq'::regclass);


--
-- Name: chat_mensajes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_mensajes ALTER COLUMN id SET DEFAULT nextval('public.chat_mensajes_id_seq'::regclass);


--
-- Name: configuracion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion ALTER COLUMN id SET DEFAULT nextval('public.configuracion_id_seq'::regclass);


--
-- Name: cuentas_bancarias id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuentas_bancarias ALTER COLUMN id SET DEFAULT nextval('public.cuentas_bancarias_id_seq'::regclass);


--
-- Name: empresa id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresa ALTER COLUMN id SET DEFAULT nextval('public.empresa_id_seq'::regclass);


--
-- Name: extractos_bancarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extractos_bancarios ALTER COLUMN id SET DEFAULT nextval('public.extractos_bancarios_id_seq'::regclass);


--
-- Name: flujos_mensajes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flujos_mensajes ALTER COLUMN id SET DEFAULT nextval('public.flujos_mensajes_id_seq'::regclass);


--
-- Name: kardex id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kardex ALTER COLUMN id SET DEFAULT nextval('public.kardex_id_seq'::regclass);


--
-- Name: produccion_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produccion_log ALTER COLUMN id SET DEFAULT nextval('public.produccion_log_id_seq'::regclass);


--
-- Name: receta_ingredientes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receta_ingredientes ALTER COLUMN id SET DEFAULT nextval('public.receta_ingredientes_id_seq'::regclass);


--
-- Name: recetas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recetas ALTER COLUMN id SET DEFAULT nextval('public.recetas_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Data for Name: categorias_inventario; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categorias_inventario (id, nombre) FROM stdin;
1	Hardware
2	Accesorios
3	Licencias
4	Equipos de Red
5	Mobiliario
6	Materias Primas
7	Otro
\.


--
-- Data for Name: categorias_transaccion; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categorias_transaccion (id, nombre, tipo) FROM stdin;
1	Ventas	income
2	Servicios	income
3	Suscripciones	income
4	Otros Ingresos	income
5	Operativa	expense
6	Infraestructura	expense
7	Sueldos	expense
8	Mantenimiento	expense
9	Marketing	expense
10	Otros Gastos	expense
\.


--
-- Data for Name: chat_mensajes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_mensajes (id, chat_id, contenido, remitente, leido, created_at) FROM stdin;
\.


--
-- Data for Name: chats; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chats (id, empresa_id, contacto_id, estado, no_leidos, ultimo_mensaje, ultima_actividad, created_at) FROM stdin;
\.


--
-- Data for Name: configuracion; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.configuracion (id, empresa_id, clave, valor, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: contactos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contactos (id, empresa_id, nombre, telefono, email, canal, activo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cuentas_bancarias; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cuentas_bancarias (id, empresa_id, nombre, banco, numero_cuenta, moneda_codigo, saldo_actual, activo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: empresa; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.empresa (id, nombre, moneda_codigo, logo_url, created_at, updated_at) FROM stdin;
1	MicroEmpresa S.A.	USD	\N	2026-03-24 12:59:57.048345+00	2026-03-24 12:59:57.048345+00
\.


--
-- Data for Name: extractos_bancarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.extractos_bancarios (id, cuenta_id, fecha, descripcion, monto, referencia_banco, conciliado, transaccion_id, created_at) FROM stdin;
\.


--
-- Data for Name: flujos_mensajes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flujos_mensajes (id, flujo_id, contenido, orden) FROM stdin;
\.


--
-- Data for Name: flujos_opciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flujos_opciones (id, flujo_id, trigger_key, etiqueta, siguiente_flujo, orden) FROM stdin;
\.


--
-- Data for Name: flujos_webhook; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flujos_webhook (id, empresa_id, nombre, trigger_keys, activo, orden, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inventario; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventario (id, empresa_id, sku, nombre, stock, min_warning, precio, categoria_id, imagen_url, tipo_item, activo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: kardex; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kardex (id, empresa_id, item_id, usuario_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia_id, notas, created_at) FROM stdin;
\.


--
-- Data for Name: monedas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.monedas (codigo, nombre, simbolo) FROM stdin;
USD	Dólar Estadounidense	$
EUR	Euro	€
MXN	Peso Mexicano	$
\.


--
-- Data for Name: produccion_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.produccion_log (id, empresa_id, producto_id, usuario_id, cantidad, notas, created_at) FROM stdin;
\.


--
-- Data for Name: receta_ingredientes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.receta_ingredientes (id, receta_id, insumo_id, cantidad) FROM stdin;
\.


--
-- Data for Name: recetas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recetas (id, producto_id) FROM stdin;
\.


--
-- Data for Name: transacciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transacciones (id, empresa_id, usuario_id, fecha, descripcion, monto, tipo, categoria_id, estado, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuarios (id, empresa_id, nombre, email, password_hash, avatar_url, rol, activo, created_at, updated_at) FROM stdin;
\.


--
-- Name: categorias_inventario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categorias_inventario_id_seq', 7, true);


--
-- Name: categorias_transaccion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categorias_transaccion_id_seq', 10, true);


--
-- Name: chat_mensajes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chat_mensajes_id_seq', 1, false);


--
-- Name: configuracion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.configuracion_id_seq', 1, false);


--
-- Name: cuentas_bancarias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cuentas_bancarias_id_seq', 1, false);


--
-- Name: empresa_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.empresa_id_seq', 1, true);


--
-- Name: extractos_bancarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.extractos_bancarios_id_seq', 1, false);


--
-- Name: flujos_mensajes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.flujos_mensajes_id_seq', 1, false);


--
-- Name: kardex_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.kardex_id_seq', 1, false);


--
-- Name: produccion_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.produccion_log_id_seq', 1, false);


--
-- Name: receta_ingredientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.receta_ingredientes_id_seq', 1, false);


--
-- Name: recetas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.recetas_id_seq', 1, false);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 1, false);


--
-- Name: categorias_inventario categorias_inventario_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_inventario
    ADD CONSTRAINT categorias_inventario_nombre_key UNIQUE (nombre);


--
-- Name: categorias_inventario categorias_inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_inventario
    ADD CONSTRAINT categorias_inventario_pkey PRIMARY KEY (id);


--
-- Name: categorias_transaccion categorias_transaccion_nombre_tipo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_transaccion
    ADD CONSTRAINT categorias_transaccion_nombre_tipo_key UNIQUE (nombre, tipo);


--
-- Name: categorias_transaccion categorias_transaccion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_transaccion
    ADD CONSTRAINT categorias_transaccion_pkey PRIMARY KEY (id);


--
-- Name: chat_mensajes chat_mensajes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_mensajes
    ADD CONSTRAINT chat_mensajes_pkey PRIMARY KEY (id);


--
-- Name: chats chats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (id);


--
-- Name: configuracion configuracion_empresa_id_clave_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_empresa_id_clave_key UNIQUE (empresa_id, clave);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (id);


--
-- Name: contactos contactos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT contactos_pkey PRIMARY KEY (id);


--
-- Name: cuentas_bancarias cuentas_bancarias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuentas_bancarias
    ADD CONSTRAINT cuentas_bancarias_pkey PRIMARY KEY (id);


--
-- Name: empresa empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresa
    ADD CONSTRAINT empresa_pkey PRIMARY KEY (id);


--
-- Name: extractos_bancarios extractos_bancarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extractos_bancarios
    ADD CONSTRAINT extractos_bancarios_pkey PRIMARY KEY (id);


--
-- Name: flujos_mensajes flujos_mensajes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flujos_mensajes
    ADD CONSTRAINT flujos_mensajes_pkey PRIMARY KEY (id);


--
-- Name: flujos_opciones flujos_opciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flujos_opciones
    ADD CONSTRAINT flujos_opciones_pkey PRIMARY KEY (id);


--
-- Name: flujos_webhook flujos_webhook_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flujos_webhook
    ADD CONSTRAINT flujos_webhook_pkey PRIMARY KEY (id);


--
-- Name: inventario inventario_empresa_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventario
    ADD CONSTRAINT inventario_empresa_id_sku_key UNIQUE (empresa_id, sku);


--
-- Name: inventario inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventario
    ADD CONSTRAINT inventario_pkey PRIMARY KEY (id);


--
-- Name: kardex kardex_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kardex
    ADD CONSTRAINT kardex_pkey PRIMARY KEY (id);


--
-- Name: monedas monedas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monedas
    ADD CONSTRAINT monedas_pkey PRIMARY KEY (codigo);


--
-- Name: produccion_log produccion_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produccion_log
    ADD CONSTRAINT produccion_log_pkey PRIMARY KEY (id);


--
-- Name: receta_ingredientes receta_ingredientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receta_ingredientes
    ADD CONSTRAINT receta_ingredientes_pkey PRIMARY KEY (id);


--
-- Name: receta_ingredientes receta_ingredientes_receta_id_insumo_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receta_ingredientes
    ADD CONSTRAINT receta_ingredientes_receta_id_insumo_id_key UNIQUE (receta_id, insumo_id);


--
-- Name: recetas recetas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recetas
    ADD CONSTRAINT recetas_pkey PRIMARY KEY (id);


--
-- Name: recetas recetas_producto_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recetas
    ADD CONSTRAINT recetas_producto_id_key UNIQUE (producto_id);


--
-- Name: transacciones transacciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transacciones
    ADD CONSTRAINT transacciones_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: idx_chat_mensajes_chat; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_mensajes_chat ON public.chat_mensajes USING btree (chat_id);


--
-- Name: idx_chat_mensajes_leido; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_mensajes_leido ON public.chat_mensajes USING btree (leido) WHERE (leido = false);


--
-- Name: idx_chat_mensajes_ts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_mensajes_ts ON public.chat_mensajes USING btree (created_at);


--
-- Name: idx_chats_actividad; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chats_actividad ON public.chats USING btree (ultima_actividad DESC);


--
-- Name: idx_chats_contacto; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chats_contacto ON public.chats USING btree (contacto_id);


--
-- Name: idx_chats_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chats_empresa ON public.chats USING btree (empresa_id);


--
-- Name: idx_chats_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chats_estado ON public.chats USING btree (estado);


--
-- Name: idx_config_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_config_empresa ON public.configuracion USING btree (empresa_id);


--
-- Name: idx_contactos_canal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contactos_canal ON public.contactos USING btree (canal);


--
-- Name: idx_contactos_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contactos_empresa ON public.contactos USING btree (empresa_id);


--
-- Name: idx_contactos_telefono; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contactos_telefono ON public.contactos USING btree (telefono);


--
-- Name: idx_cuentas_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cuentas_empresa ON public.cuentas_bancarias USING btree (empresa_id);


--
-- Name: idx_extractos_conciliado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_extractos_conciliado ON public.extractos_bancarios USING btree (conciliado) WHERE (conciliado = false);


--
-- Name: idx_extractos_cuenta; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_extractos_cuenta ON public.extractos_bancarios USING btree (cuenta_id);


--
-- Name: idx_extractos_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_extractos_fecha ON public.extractos_bancarios USING btree (fecha);


--
-- Name: idx_flujos_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_flujos_empresa ON public.flujos_webhook USING btree (empresa_id);


--
-- Name: idx_flujos_mensajes_flujo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_flujos_mensajes_flujo ON public.flujos_mensajes USING btree (flujo_id);


--
-- Name: idx_flujos_opciones_flujo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_flujos_opciones_flujo ON public.flujos_opciones USING btree (flujo_id);


--
-- Name: idx_inv_categoria; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inv_categoria ON public.inventario USING btree (categoria_id);


--
-- Name: idx_inv_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inv_empresa ON public.inventario USING btree (empresa_id);


--
-- Name: idx_inv_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inv_sku ON public.inventario USING btree (sku);


--
-- Name: idx_inv_stock; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inv_stock ON public.inventario USING btree (stock);


--
-- Name: idx_inv_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inv_tipo ON public.inventario USING btree (tipo_item);


--
-- Name: idx_kardex_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_kardex_empresa ON public.kardex USING btree (empresa_id);


--
-- Name: idx_kardex_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_kardex_fecha ON public.kardex USING btree (created_at);


--
-- Name: idx_kardex_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_kardex_item ON public.kardex USING btree (item_id);


--
-- Name: idx_kardex_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_kardex_tipo ON public.kardex USING btree (tipo_movimiento);


--
-- Name: idx_prodlog_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prodlog_empresa ON public.produccion_log USING btree (empresa_id);


--
-- Name: idx_prodlog_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prodlog_fecha ON public.produccion_log USING btree (created_at);


--
-- Name: idx_prodlog_producto; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prodlog_producto ON public.produccion_log USING btree (producto_id);


--
-- Name: idx_receta_ing_insumo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_receta_ing_insumo ON public.receta_ingredientes USING btree (insumo_id);


--
-- Name: idx_receta_ing_receta; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_receta_ing_receta ON public.receta_ingredientes USING btree (receta_id);


--
-- Name: idx_tx_categoria; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tx_categoria ON public.transacciones USING btree (categoria_id);


--
-- Name: idx_tx_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tx_empresa ON public.transacciones USING btree (empresa_id);


--
-- Name: idx_tx_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tx_estado ON public.transacciones USING btree (estado);


--
-- Name: idx_tx_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tx_fecha ON public.transacciones USING btree (fecha);


--
-- Name: idx_tx_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tx_tipo ON public.transacciones USING btree (tipo);


--
-- Name: idx_tx_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tx_usuario ON public.transacciones USING btree (usuario_id);


--
-- Name: idx_usuarios_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_email ON public.usuarios USING btree (email);


--
-- Name: idx_usuarios_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_empresa ON public.usuarios USING btree (empresa_id);


--
-- Name: chat_mensajes chat_mensajes_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_mensajes
    ADD CONSTRAINT chat_mensajes_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- Name: chats chats_contacto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES public.contactos(id) ON DELETE CASCADE;


--
-- Name: chats chats_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- Name: configuracion configuracion_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- Name: contactos contactos_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT contactos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- Name: cuentas_bancarias cuentas_bancarias_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuentas_bancarias
    ADD CONSTRAINT cuentas_bancarias_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- Name: cuentas_bancarias cuentas_bancarias_moneda_codigo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuentas_bancarias
    ADD CONSTRAINT cuentas_bancarias_moneda_codigo_fkey FOREIGN KEY (moneda_codigo) REFERENCES public.monedas(codigo) ON UPDATE CASCADE;


--
-- Name: empresa empresa_moneda_codigo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresa
    ADD CONSTRAINT empresa_moneda_codigo_fkey FOREIGN KEY (moneda_codigo) REFERENCES public.monedas(codigo) ON UPDATE CASCADE;


--
-- Name: extractos_bancarios extractos_bancarios_cuenta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extractos_bancarios
    ADD CONSTRAINT extractos_bancarios_cuenta_id_fkey FOREIGN KEY (cuenta_id) REFERENCES public.cuentas_bancarias(id) ON DELETE CASCADE;


--
-- Name: extractos_bancarios extractos_bancarios_transaccion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extractos_bancarios
    ADD CONSTRAINT extractos_bancarios_transaccion_id_fkey FOREIGN KEY (transaccion_id) REFERENCES public.transacciones(id) ON DELETE SET NULL;


--
-- Name: flujos_mensajes flujos_mensajes_flujo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flujos_mensajes
    ADD CONSTRAINT flujos_mensajes_flujo_id_fkey FOREIGN KEY (flujo_id) REFERENCES public.flujos_webhook(id) ON DELETE CASCADE;


--
-- Name: flujos_opciones flujos_opciones_flujo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flujos_opciones
    ADD CONSTRAINT flujos_opciones_flujo_id_fkey FOREIGN KEY (flujo_id) REFERENCES public.flujos_webhook(id) ON DELETE CASCADE;


--
-- Name: flujos_opciones flujos_opciones_siguiente_flujo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flujos_opciones
    ADD CONSTRAINT flujos_opciones_siguiente_flujo_fkey FOREIGN KEY (siguiente_flujo) REFERENCES public.flujos_webhook(id) ON DELETE SET NULL;


--
-- Name: flujos_webhook flujos_webhook_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flujos_webhook
    ADD CONSTRAINT flujos_webhook_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- Name: inventario inventario_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventario
    ADD CONSTRAINT inventario_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_inventario(id);


--
-- Name: inventario inventario_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventario
    ADD CONSTRAINT inventario_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- Name: kardex kardex_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kardex
    ADD CONSTRAINT kardex_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- Name: kardex kardex_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kardex
    ADD CONSTRAINT kardex_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventario(id);


--
-- Name: kardex kardex_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kardex
    ADD CONSTRAINT kardex_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: produccion_log produccion_log_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produccion_log
    ADD CONSTRAINT produccion_log_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- Name: produccion_log produccion_log_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produccion_log
    ADD CONSTRAINT produccion_log_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.inventario(id);


--
-- Name: produccion_log produccion_log_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produccion_log
    ADD CONSTRAINT produccion_log_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: receta_ingredientes receta_ingredientes_insumo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receta_ingredientes
    ADD CONSTRAINT receta_ingredientes_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES public.inventario(id) ON DELETE RESTRICT;


--
-- Name: receta_ingredientes receta_ingredientes_receta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receta_ingredientes
    ADD CONSTRAINT receta_ingredientes_receta_id_fkey FOREIGN KEY (receta_id) REFERENCES public.recetas(id) ON DELETE CASCADE;


--
-- Name: recetas recetas_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recetas
    ADD CONSTRAINT recetas_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.inventario(id) ON DELETE CASCADE;


--
-- Name: transacciones transacciones_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transacciones
    ADD CONSTRAINT transacciones_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_transaccion(id);


--
-- Name: transacciones transacciones_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transacciones
    ADD CONSTRAINT transacciones_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- Name: transacciones transacciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transacciones
    ADD CONSTRAINT transacciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: usuarios usuarios_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

