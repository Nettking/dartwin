# DarTwin Visualizer

This project provides a visual editor for DarTwin specifications. You can run it locally with Node.js or inside a Docker container.

## Prerequisites

- Node.js 20+ (only if you want to run it without Docker)
- Docker (for containerized execution)

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser. The dev server reloads automatically when you edit files.

## Running with Docker

Build the image and start the development server:

```bash
docker build -t dartwin .
docker run --rm -it -p 5173:5173 dartwin
```

Then visit http://localhost:5173.

The container runs the same Vite development server with hot module reloading enabled and listens on all interfaces so the port binding works from the host.

## Additional scripts

- `npm run build` – type-checks the project and creates an optimized production build in `dist/`.
- `npm run preview` – serves the production build locally.

## Project structure

The entry point is [`main.tsx`](./main.tsx), which renders [`App.tsx`](./App.tsx). Supporting logic lives in the `components`, `styles`, `types.ts`, and `utils` directories.
