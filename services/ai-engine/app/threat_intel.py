from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

# MVP local threat intelligence list.
# Later: replace/augment with providers that fetch external feeds.
MALICIOUS_IPS: List[str] = [
    "185.23.12.45",
    "185.23.12.58",
    "185.23.12.129",
]


@dataclass(frozen=True)
class ThreatIntelClassification:
    threat_type: str
    risk_level: str
    risk_score: float
    explanations: List[str]


class ThreatIntelProvider:
    def classify_source_ip(self, ip: Optional[str]) -> Optional[ThreatIntelClassification]:
        raise NotImplementedError


class LocalListThreatIntelProvider(ThreatIntelProvider):
    def __init__(self, malicious_ips: List[str]):
        self._malicious = set(malicious_ips)

    def classify_source_ip(self, ip: Optional[str]) -> Optional[ThreatIntelClassification]:
        if not ip:
            return None

        if ip in self._malicious:
            return ThreatIntelClassification(
                threat_type="malicious_ip_activity",
                risk_level="high",
                risk_score=0.9,
                explanations=["Source IP matches known malicious IP list"],
            )

        return None


DEFAULT_PROVIDER: ThreatIntelProvider = LocalListThreatIntelProvider(MALICIOUS_IPS)


def classify_source_ip(ip: Optional[str], provider: ThreatIntelProvider = DEFAULT_PROVIDER) -> Optional[ThreatIntelClassification]:
    """Classify an event based on source IP threat intel.

    Extensible design: pass a different provider later (external feed, caching, etc.).
    """

    return provider.classify_source_ip(ip)
