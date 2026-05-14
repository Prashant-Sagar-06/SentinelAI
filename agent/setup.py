from setuptools import setup, find_packages

setup(
    name="sentinel-agent",
    version="0.1.0",
    packages=find_packages(),
    install_requires=["psutil", "httpx"],
    entry_points={
        "console_scripts": [
            "sentinel-agent=sentinel_agent.agent:run",
        ]
    },
)