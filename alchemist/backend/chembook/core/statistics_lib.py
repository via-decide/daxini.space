from __future__ import annotations

from typing import Iterable, Dict, List
import math


def mean(values: Iterable[float]) -> float:
    data = list(values)
    return sum(data) / len(data) if data else 0.0


def stddev(values: Iterable[float], sample: bool = True) -> float:
    data = list(values)
    if len(data) < 2:
        return 0.0
    mu = mean(data)
    denom = (len(data) - 1) if sample else len(data)
    return math.sqrt(sum((x - mu) ** 2 for x in data) / denom)


def linear_regression(x: List[float], y: List[float]) -> Dict[str, float]:
    if len(x) != len(y) or len(x) < 2:
        return {"slope": 0.0, "intercept": 0.0, "r_squared": 0.0}

    x_mu = mean(x)
    y_mu = mean(y)
    sxy = sum((xi - x_mu) * (yi - y_mu) for xi, yi in zip(x, y))
    sxx = sum((xi - x_mu) ** 2 for xi in x)
    if sxx == 0:
        return {"slope": 0.0, "intercept": y_mu, "r_squared": 0.0}

    slope = sxy / sxx
    intercept = y_mu - slope * x_mu
    y_hat = [slope * xi + intercept for xi in x]
    ss_tot = sum((yi - y_mu) ** 2 for yi in y)
    ss_res = sum((yi - yhi) ** 2 for yi, yhi in zip(y, y_hat))
    r_squared = 1 - ss_res / ss_tot if ss_tot else 0.0
    return {"slope": slope, "intercept": intercept, "r_squared": r_squared}
