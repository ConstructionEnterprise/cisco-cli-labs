# Deferred Engineering Work

## Frontend Bundle Splitting

**Priority:** Medium

The production Vite build currently emits a main JavaScript bundle of about 2.2 MB (about 597 kB gzipped), exceeding Vite's 500 kB advisory threshold. The build succeeds, but first-load performance can improve.

Investigate route- or feature-level dynamic imports for the curriculum, sandbox viewports, and optional 3D dependencies. Use Rollup `manualChunks` only after measuring the resulting user-facing load behavior. Keep the guided lab, Network Sandbox, and Operations Sandbox entry flows working independently after splitting.
