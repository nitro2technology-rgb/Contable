# Especificaciones: Software Contable Interno S.A.S.

## 1. Módulos Esenciales
*   **Ingresos y Clientes:** Registro de proyectos de desarrollo o automatización, fechas de cobro y estado de pago.
*   **Gastos Operativos:** Control de egresos recurrentes (servidores, APIs, dominios, marketing).
*   **Movimientos de Socios:** Módulo exclusivo para registrar retiros o préstamos a los socios. Contablemente se clasifica como "Cuentas por cobrar a socios" y se cruza con futuras utilidades.
*   **Dashboard de Flujo de Caja:** Vista principal con el cálculo: `Ingresos - Gastos = Utilidad Neta`.

## 2. Alertas Legales y Tributarias (IVA)
*   **Responsabilidad:** Como Persona Jurídica (S.A.S.), **no hay tope mínimo para cobrar IVA**. Se es responsable desde el primer peso facturado.
*   **Tipos de Servicio:** El sistema debe incluir un selector al facturar. Servicios como desarrollo o consultoría de datos están gravados al 19%, mientras que otros (cloud, licenciamiento SaaS) podrían tener exenciones.

## 3. Arquitectura Recomendada
*   **Base de Datos:** Relacional (PostgreSQL o SQL Server) para garantizar la integridad financiera de cada registro.
*   **Backend:** FastAPI (Python) para gestionar la lógica de negocio y las peticiones del frontend de manera eficiente.
