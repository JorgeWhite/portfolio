import math
import os
import random

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

try:
    from birthday_endpoint import router as birthday_router
except ModuleNotFoundError:
    birthday_router = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GamblersRuinExplainRequest(BaseModel):
    n: int = Field(default=20, ge=2, le=2000)
    initial_capital: int = Field(default=10, ge=1)
    p_win: float = Field(default=0.5, gt=0.0, lt=1.0)
    monte_carlo_trials: int = Field(default=0, ge=0, le=200000)
    seed: int | None = None

    @model_validator(mode="after")
    def validate_state_bounds(self) -> "GamblersRuinExplainRequest":
        if self.initial_capital >= self.n:
            raise ValueError("initial_capital must be strictly smaller than n")
        return self


def theoretical_ruin_probability(i: int, n: int, p: float) -> float:
    q = 1.0 - p
    if math.isclose(p, q):
        return 1.0 - (i / n)

    ratio = q / p
    numerator = (ratio**i) - (ratio**n)
    denominator = 1.0 - (ratio**n)
    return numerator / denominator


def theoretical_expected_steps(i: int, n: int, p: float) -> float:
    q = 1.0 - p
    if math.isclose(p, q):
        return float(i * (n - i))

    ratio = q / p
    drift = q - p
    first_term = i / drift
    second_term = (n / drift) * ((1.0 - (ratio**i)) / (1.0 - (ratio**n)))
    return first_term - second_term


def run_monte_carlo(i: int, n: int, p: float, trials: int, seed: int | None) -> dict:
    if trials == 0:
        return {
            "trials": 0,
            "ruin_probability": None,
            "mean_steps": None,
            "hits_target_probability": None,
        }

    rng = random.Random(seed)
    ruins = 0
    total_steps = 0

    for _ in range(trials):
        money = i
        steps = 0
        while 0 < money < n:
            if rng.random() < p:
                money += 1
            else:
                money -= 1
            steps += 1

        total_steps += steps
        if money == 0:
            ruins += 1

    ruin_probability = ruins / trials
    return {
        "trials": trials,
        "ruin_probability": ruin_probability,
        "mean_steps": total_steps / trials,
        "hits_target_probability": 1.0 - ruin_probability,
    }


@app.post("/api/gamblers-ruin/explain")
@app.post("/gamblers-ruin/explain")
def explain_gamblers_ruin(payload: GamblersRuinExplainRequest):
    try:
        i = payload.initial_capital
        n = payload.n
        p = payload.p_win

        ruin_prob = theoretical_ruin_probability(i, n, p)
        expected_steps = theoretical_expected_steps(i, n, p)
        monte_carlo = run_monte_carlo(i, n, p, payload.monte_carlo_trials, payload.seed)

        return {
            "model": {
                "n": n,
                "initial_capital": i,
                "p_win": p,
                "p_lose": 1.0 - p,
            },
            "theory": {
                "ruin_probability": ruin_prob,
                "target_probability": 1.0 - ruin_prob,
                "expected_steps_to_absorption": expected_steps,
            },
            "monte_carlo": monte_carlo,
            "didactic_explanation": {
                "summary": "Gambler's Ruin is a finite Markov chain with absorbing states at 0 and n. Starting from i, each round changes capital by +1 with probability p or -1 with probability q=1-p until absorption.",
                "how_it_works": "The process is memoryless: the next move depends only on current capital, not on the path taken. If capital reaches 0, the gambler is ruined; if it reaches n, the gambler hits the target and stops.",
                "intuition": "Even with fair odds (p=0.5), finite boundaries force eventual absorption. Bias changes which absorbing state is more likely: if p>0.5, reaching n becomes more probable; if p<0.5, ruin dominates.",
                "history": "The problem became classical in probability during the 17th-18th century in the context of random games and was later formalized with random walks and Markov chains. It remains a core example to teach absorption probabilities and expected hitting times.",
                "notation": "i: initial capital, n: target capital, p: p_win, q: 1-p.",
                "ruin_formula": "If p = 0.5: P_0(i) = 1 - i/n. If p != 0.5: P_0(i) = ((q/p)^i - (q/p)^n) / (1 - (q/p)^n).",
                "target_formula": "If p = 0.5: P_n(i) = i/n. If p != 0.5: P_n(i) = (1 - (q/p)^i) / (1 - (q/p)^n).",
                "expected_time_formula": "If p_win = 0.5: E[T_i] = i(n-i). If p_win != 0.5: E[T_i] = i/(q-p) - (n/(q-p))*((1-(q/p)^i)/(1-(q/p)^n)).",
            },
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@app.get("/")
def root():
    return {"message": "Backend is running 🚀"}

@app.get("/hello")
def hello():
    return {"hello": "Hello from FastAPI, Deployment test succesful, newer version"}


if os.getenv("ENABLE_BIRTHDAY_ENDPOINT", "1") == "1" and birthday_router is not None:
    app.include_router(birthday_router)

