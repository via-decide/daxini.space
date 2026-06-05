from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt


def _save_plot(out: Path, title: str):
    out.parent.mkdir(parents=True, exist_ok=True)
    plt.title(title)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(out)
    plt.close()


def titration_curve(out: Path):
    x = np.linspace(0, 25, 250)
    y = 3 + 8 / (1 + np.exp(-(x - 12.5)))
    plt.plot(x, y)
    plt.xlabel("Volume titrant (mL)")
    plt.ylabel("pH")
    _save_plot(out, "Acid-Base Titration Curve")


def spectroscopy_diagram(out: Path):
    wl = np.linspace(200, 800, 400)
    absorbance = np.exp(-((wl - 320) ** 2) / 2500) + 0.5 * np.exp(-((wl - 520) ** 2) / 1800)
    plt.plot(wl, absorbance)
    plt.xlabel("Wavelength (nm)")
    plt.ylabel("Absorbance")
    _save_plot(out, "UV-Vis Spectrum")


def chromatogram(out: Path):
    t = np.linspace(0, 20, 2000)
    signal = (
        np.exp(-((t - 4) ** 2) / 0.3)
        + 1.2 * np.exp(-((t - 9.2) ** 2) / 0.5)
        + 0.8 * np.exp(-((t - 14.8) ** 2) / 0.7)
    )
    plt.plot(t, signal)
    plt.xlabel("Retention time (min)")
    plt.ylabel("Detector response")
    _save_plot(out, "Chromatogram")


def stats_graph(out: Path):
    x = np.arange(1, 11)
    y = 0.95 * x + np.random.normal(0, 0.35, size=len(x))
    coef = np.polyfit(x, y, 1)
    plt.scatter(x, y)
    plt.plot(x, coef[0] * x + coef[1])
    plt.xlabel("Concentration")
    plt.ylabel("Signal")
    _save_plot(out, "Calibration Curve")
