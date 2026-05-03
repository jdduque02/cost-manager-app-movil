# Manual de Usuario — Cost Manager Mobile

> Versión 1.0.0 · Fecha: 2026-04-28

---

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [Inicio de sesión](#2-inicio-de-sesión)
3. [Pantalla principal — Resumen](#3-pantalla-principal--resumen)
4. [Transacciones](#4-transacciones)
5. [Cuentas bancarias](#5-cuentas-bancarias)
6. [Objetivos financieros](#6-objetivos-financieros)
7. [Perfil de usuario](#7-perfil-de-usuario)
8. [Modo sin conexión (Offline)](#8-modo-sin-conexión-offline)
9. [Sincronización de datos](#9-sincronización-de-datos)
10. [Recuperación de contraseña](#10-recuperación-de-contraseña)

---

## 1. Primeros pasos

### Requisitos

- Dispositivo Android 10+ o iOS 14+.
- Conexión a Internet para el primer inicio de sesión.
- Cuenta registrada previamente por el administrador del sistema.

### Instalación

1. Descarga la aplicación desde la tienda oficial (Play Store / App Store).
2. Abre la app. Verás la pantalla de **Bienvenida → Iniciar sesión**.
3. Ingresa tus credenciales y pulsa **Entrar**.

---

## 2. Inicio de sesión

### Con conexión a Internet

1. Escribe tu **nombre de usuario** y **contraseña**.
2. Pulsa **Iniciar sesión**.
3. Si las credenciales son correctas, accederás al panel principal.

### Sin conexión (modo offline)

Si no tienes acceso a Internet pero ya iniciaste sesión anteriormente:

1. Pulsa **Continuar sin conexión** (si aparece la opción).
2. La app usará tu perfil almacenado localmente.
3. Podrás consultar y registrar datos; se sincronizarán cuando recuperes la red.

> **Nota de seguridad:** Después de 5 intentos fallidos de inicio de sesión, la app bloqueará los intentos durante 15 minutos para proteger tu cuenta.

### Cerrar sesión

Ve a **Perfil → Cerrar sesión**. Tu sesión se invalida en el servidor y los tokens locales se eliminan de forma segura.

---

## 3. Pantalla principal — Resumen

La pantalla **Inicio** muestra un resumen financiero del mes actual:

| Elemento             | Descripción                                    |
| -------------------- | ---------------------------------------------- |
| **Balance total**    | Suma de todas las cuentas activas              |
| **Ingresos del mes** | Total de transacciones tipo INGRESO            |
| **Gastos del mes**   | Total de transacciones tipo GASTO              |
| **Accesos rápidos**  | Botones para crear transacción o ver objetivos |

---

## 4. Transacciones

### Ver transacciones

1. Toca la pestaña **Transacciones** en la barra inferior.
2. Las transacciones aparecen ordenadas por fecha (más recientes primero).
3. Usa los filtros en la parte superior para buscar por fecha, categoría o tipo.

### Registrar una transacción

1. Pulsa el botón **＋** (más).
2. Completa los campos:
   - **Tipo**: INGRESO, GASTO o TRANSFERENCIA.
   - **Monto**: valor numérico positivo.
   - **Categoría / Subcategoría**: clasifica el movimiento.
   - **Cuenta**: cuenta bancaria asociada.
   - **Fecha**: por defecto es el día actual.
   - **Descripción** (opcional).
3. Pulsa **Guardar**.

> Si estás **sin conexión**, la transacción se almacena localmente y se sincronizará automáticamente cuando vuelvas a tener red.

### Tipos de transacción

| Tipo          | Icono | Efecto en balance             |
| ------------- | ----- | ----------------------------- |
| INGRESO       | ↑     | Suma al balance de la cuenta  |
| GASTO         | ↓     | Resta al balance de la cuenta |
| TRANSFERENCIA | ⇄     | Mueve saldo entre cuentas     |

---

## 5. Cuentas bancarias

### Ver cuentas

1. Ve a la pestaña **Banca**.
2. Verás la lista de cuentas con su nombre, banco y balance actual.

### Crear una cuenta

1. Pulsa **Nueva cuenta**.
2. Ingresa:
   - **Nombre**: nombre descriptivo (ej. "Cuenta corriente Bancolombia").
   - **Banco**: nombre de la entidad financiera.
   - **Tipo de cuenta**: Ahorros, Corriente, etc.
   - **Balance inicial**: saldo de apertura.
   - **Moneda**: por defecto COP.
3. Pulsa **Guardar**.

---

## 6. Objetivos financieros

### Ver objetivos

1. Ve a la pestaña **Objetivos**.
2. Cada objetivo muestra:
   - **Nombre** del objetivo.
   - **Progreso**: barra visual y porcentaje alcanzado.
   - **Monto actual** vs **Meta**.
   - **Fecha límite** (si aplica).

### Crear un objetivo

1. Pulsa **＋ Nuevo objetivo**.
2. Completa:
   - **Nombre** (ej. "Fondo de emergencia").
   - **Monto meta** en COP.
   - **Fecha límite** (opcional).
3. Pulsa **Crear**.

### Actualizar progreso

Al registrar una transacción de tipo INGRESO asociada a un objetivo, el monto actual del objetivo se actualiza automáticamente.

---

## 7. Perfil de usuario

### Ver y editar perfil

1. Ve a la pestaña **Perfil**.
2. Puedes ver tu nombre, usuario y correo.
3. Para editar, pulsa **Editar perfil** (requiere conexión).

### Cambiar contraseña

1. Ve a **Perfil → Cambiar contraseña**.
2. Ingresa tu contraseña actual y la nueva dos veces.
3. La nueva contraseña debe cumplir:
   - Mínimo 8 caracteres.
   - Al menos una mayúscula, una minúscula y un número.

---

## 8. Modo sin conexión (Offline)

La app funciona completamente sin Internet gracias a una base de datos local SQLite.

### Indicador de estado

En la parte superior de la pantalla aparece una **franja amarilla** cuando no hay conexión:

```
⚡ Modo offline — los cambios se guardan localmente     [3]
```

El número entre corchetes indica cuántos cambios están pendientes de sincronización.

### Qué puedes hacer sin conexión

| Acción                         | Disponible           |
| ------------------------------ | -------------------- |
| Ver transacciones guardadas    | ✅                   |
| Registrar transacciones        | ✅ (se guarda local) |
| Ver cuentas bancarias          | ✅                   |
| Crear cuentas bancarias        | ✅ (se guarda local) |
| Ver objetivos                  | ✅                   |
| Crear objetivos                | ✅ (se guarda local) |
| Iniciar sesión por primera vez | ❌ (requiere red)    |
| Cambiar contraseña             | ❌ (requiere red)    |

---

## 9. Sincronización de datos

Cuando recuperas la conexión a Internet:

1. La app detecta automáticamente que volvió la red.
2. Se inicia la **sincronización automática** de los cambios pendientes.
3. Aparece una **franja azul** con el mensaje "Sincronizando datos..." y un indicador giratorio.
4. Al completarse, la franja desaparece.

### Sincronización manual

Si la sincronización automática no se dispara:

1. Espera a que aparezca la franja con "N cambio(s) pendiente(s)".
2. Pulsa el botón **Sincronizar**.

### Conflictos

En caso de conflicto (el mismo dato fue modificado tanto local como en el servidor), el servidor tiene prioridad. Se recomienda sincronizar frecuentemente para minimizar conflictos.

---

## 10. Recuperación de contraseña

1. En la pantalla de inicio de sesión, pulsa **¿Olvidaste tu contraseña?**
2. Ingresa tu correo electrónico registrado.
3. Recibirás un correo con un enlace para restablecer tu contraseña.
4. Sigue las instrucciones del correo (el enlace expira en 15 minutos).

---

## Preguntas frecuentes

**¿Puedo tener varias cuentas bancarias?**
Sí, puedes registrar todas las cuentas que necesites.

**¿Los datos están seguros en el dispositivo?**
Sí. Los tokens de sesión se almacenan en el `SecureStore` cifrado del dispositivo. La base de datos local usa `PRAGMA secure_delete = ON` para sobreescribir datos eliminados.

**¿Qué pasa si desinstalo la app?**
Los datos locales se eliminan. Los datos que ya se sincronizaron con el servidor se conservan y se restaurarán al volver a iniciar sesión.

**¿La app consume muchos datos móviles?**
El consumo es mínimo. Solo se envían y reciben los cambios incrementales durante la sincronización.
