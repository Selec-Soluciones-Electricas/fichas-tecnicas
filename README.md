# Fichas Técnicas

## 1. Patrón de diseño

El proyecto utiliza una **arquitectura basada en componentes**, implementada con React y Next.js.

La interfaz se divide en diferentes componentes, donde cada uno tiene una responsabilidad específica. El componente principal `FichaTecnicaGenerator` coordina la información y utiliza componentes secundarios como `FichaHeader`, `FichaBody` y `FichaFooter`.

La estructura principal de los componentes es:

```text
FichaTecnicaGenerator
├── FichaHeader
├── FichaBody
└── FichaFooter
```

Además, el proyecto utiliza una API de Next.js ubicada en `src/app/api/ai-extract/route.ts`, encargada del procesamiento de información mediante inteligencia artificial.

---

## 2. Estructura del proyecto

La estructura principal del proyecto es:

```text
fichas-tecnicas/
├── public/
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── ai-extract/
│   │   │       └── route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── FichaBody.tsx
│   │   ├── FichaFooter.tsx
│   │   ├── FichaHeader.tsx
│   │   └── FichaTecnicaGenerator.tsx
│   │
│   └── img/
│
├── package.json
├── package-lock.json
├── next.config.ts
├── tsconfig.json
└── eslint.config.mjs
```

### Carpetas y archivos principales

| Archivo / carpeta         | Descripción                                                      |
| ------------------------- | ---------------------------------------------------------------- |
| `src/app/`                | Contiene las páginas y funcionalidades principales de Next.js.   |
| `src/app/page.tsx`        | Página principal de la aplicación.                               |
| `src/app/layout.tsx`      | Define la estructura general de la aplicación.                   |
| `src/app/api/ai-extract/` | Contiene la API utilizada para el procesamiento mediante IA.     |
| `src/components/`         | Contiene los componentes reutilizables de React.                 |
| `public/`                 | Contiene recursos públicos utilizados por la aplicación.         |
| `package.json`            | Contiene las dependencias, scripts y versiones del proyecto.     |
| `package-lock.json`       | Registra las versiones concretas de las dependencias instaladas. |
| `next.config.ts`          | Configuración de Next.js.                                        |
| `tsconfig.json`           | Configuración de TypeScript.                                     |

---

## 3. Componentes y función

### FichaTecnicaGenerator

Es el componente principal de la aplicación. Se encarga de gestionar la información de la ficha técnica, controlar el estado de los datos, procesar archivos PDF, extraer información, gestionar imágenes y comunicarse con la API de inteligencia artificial.

### FichaHeader

Representa la cabecera de la ficha técnica. Muestra información como el logo, la empresa y el código del documento.

### FichaBody

Representa el contenido principal de la ficha técnica. Muestra información como el título, marca, modelo, descripción, fotografías, especificaciones técnicas y notas.

### FichaFooter

Representa el pie de la ficha técnica. Contiene información como la empresa, contacto y fecha.

### API `ai-extract`

La ruta `src/app/api/ai-extract/route.ts` recibe información extraída de los documentos y utiliza inteligencia artificial para obtener datos estructurados para la ficha técnica.

El proyecto puede utilizar OpenAI y dispone de una alternativa mediante Ollama.

---

## 4. Versiones

Las principales tecnologías y versiones utilizadas en el proyecto son:

| Tecnología   | Versión  |
| ------------ | -------- |
| Next.js      | 16.2.10  |
| React        | 19.2.4   |
| React DOM    | 19.2.4   |
| TypeScript   | ^5       |
| PDF.js       | ^5.6.205 |
| ESLint       | ^9       |
| Tailwind CSS | ^4       |

Estas dependencias se encuentran definidas principalmente en el archivo `package.json`.

---

## 5. Ejecución del proyecto

### Requisitos previos

Es necesario tener instalado:

* Node.js
* npm

### Instalación

Clonar o descargar el proyecto y acceder a su carpeta:

```bash
cd fichas-tecnicas
```

Instalar las dependencias:

```bash
npm install
```

### Ejecución en modo desarrollo

Para iniciar el proyecto:

```bash
npm run dev
```

Una vez iniciado, acceder desde el navegador a:

```text
http://localhost:3000
```

### Ejecución en producción

Para generar la versión de producción:

```bash
npm run build
```

Después, iniciar la aplicación:

```bash
npm start
```
