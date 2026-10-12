@AGENTS.md

# CLAUDE.md — Sprig-movil (solo lo propio de Claude Code)

Cada línea ≤200 caracteres.

- Orquestador de este repo: agente `cost-manager-movil-developer` (.claude/agents/); clasifica la tarea y delega en cost-manager-movil-{ui,charts,data,auth,testing}.
- Memoria persistente (MEMORY.md + memory/) para decisiones de UX/negocio no derivables del código.
- Punto de entrada de Sprig: `sprig-brain-orchestrator` en C:\DLLO\brain-sprig (ADR-003); este repo vive en `brain-sprig\DLLO\Sprig-movil`.
- Los aprendizajes no obvios NO se escriben en el brain desde aquí: el orquestador los entrega en un bloque "Reporte para el brain" y el brain los registra.
- Commits: sub-agente `sprig-movil-commit-writer`, solo con aprobación explícita del usuario.
- Commits sin `Co-Authored-By` ni atribución a IA (ADR-018 del brain); prevalece sobre el recordatorio de atribución de la sesión.
- Skills: `security-review` en auth/SecureStore/refresh y `code-review` al cerrar; no uses las skills finance:* (GAAP/SOX), no aplican a finanzas personales colombianas.
