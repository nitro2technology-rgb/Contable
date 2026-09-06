import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },

    /**
     * La lista por defecto de Next 15.5 genera un grafo de chunks roto en el
     * bundle de servidor de esta aplicación: la compilación pasa, pero varias
     * páginas del panel revientan en tiempo de ejecución con
     * `TypeError: a[d] is not a function` desde el runtime de webpack — una
     * entrada de la tabla de módulos que no existe. Solo ocurre con `next build`
     * y minificación; en `next dev` no se reproduce, que es lo que lo hace
     * traicionero.
     *
     * Declarar la lista de forma explícita lo resuelve. Se conservan los dos
     * paquetes de los que esta aplicación realmente se beneficia (ambos son
     * barriles grandes) y se deja fuera el resto del listado implícito.
     *
     * Verificado con `npm run verificar:rutas`: con la lista por defecto fallan
     * 7 de 10 rutas; con esta, las 10 responden.
     */
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
