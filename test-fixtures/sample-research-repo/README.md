# Orbit Sim

Install with `pip install -e .`. To run: `python run.py --steps 1000`.

## API

`integrate(state, dt)` returns the next state. `dt` must be < 0.01 or it diverges.

## Why symplectic?

We use a leapfrog integrator because energy drift matters over long runs...
