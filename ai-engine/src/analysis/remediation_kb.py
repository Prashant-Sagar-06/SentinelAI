"""
SentinelAI - Remediation Knowledge Base
========================================

This module defines a rule-based, deterministic knowledge base that maps
root cause patterns to remediation guidance. It is intentionally free of
ML/LLM calls and designed for explainability and interview readiness.

WHY A KNOWLEDGE BASE?
---------------------
1. Deterministic - Same input → Same output (no randomness)
2. Explainable - Every mapping is explicit and auditable
3. Fast - No network calls, pure Python logic
4. Maintainable - Easy to add new rules and categories
5. Interview-safe - Clear decision logic, no black boxes

DESIGN:
- Each remediation entry covers an issue category
- Matches based on keywords in service name and error message
- Returns structured remediation guidance
- Confidence-based matching (higher matches = higher confidence)
"""

from typing import Dict, List, Optional
from enum import Enum
from dataclasses import dataclass


class Priority(str, Enum):
    """Remediation priority levels."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class RemediationEntry:
    """
    Single remediation guidance entry.
    
    Attributes:
        issue_category: Unique identifier for the issue type
        description: Short professional explanation of the issue
        fix_steps: List of concise bullet-point fix steps
        priority: Priority level (affects urgency in dashboard)
        estimated_resolution_time: Human-readable time estimate
        keywords: List of keywords that trigger this remediation
    """
    issue_category: str
    description: str
    fix_steps: List[str]
    priority: Priority
    estimated_resolution_time: str
    keywords: List[str]


# ============================================================================
# REMEDIATION KNOWLEDGE BASE
# ============================================================================
# Each entry maps a root cause pattern to structured remediation guidance.
# Keywords are matched case-insensitively against service names and messages.

REMEDIATION_KB: Dict[str, RemediationEntry] = {
    
    # ========== DATABASE ISSUES ==========
    
    "database_connection_error": RemediationEntry(
        issue_category="database_connection_error",
        description="MongoDB connection pool is exhausted or unavailable. "
                   "The application cannot establish new database connections.",
        fix_steps=[
            "Verify MongoDB service is running: check server logs and cluster status",
            "Check database connection string and credentials in environment variables",
            "Review connection pool size and timeout settings",
            "Check network connectivity to MongoDB instance (firewall, VPN, IP whitelist)",
            "Restart the application service to reset connection pool",
            "If using MongoDB Atlas: verify cluster IP whitelist and network settings",
            "Review MongoDB slow query logs to identify blocking operations",
            "Increase connection pool size if legitimate high load is expected"
        ],
        priority=Priority.CRITICAL,
        estimated_resolution_time="5-15 minutes",
        keywords=["mongodb", "connection", "failed", "pool", "timeout", "unavailable", "database", "error"]
    ),
    
    "database_auth_failure": RemediationEntry(
        issue_category="database_auth_failure",
        description="MongoDB authentication failed. Credentials are invalid or permissions "
                   "have changed. The application cannot access the database.",
        fix_steps=[
            "Verify MongoDB username and password are correct",
            "Check if user permissions have changed or account was revoked",
            "Verify the database name matches the user's assigned database",
            "Check for special characters in password (URL-encode if needed)",
            "Review MongoDB user roles and ensure read/write permissions are assigned",
            "Check MongoDB user account status (not disabled or locked)",
            "Rotate credentials if compromise is suspected",
            "Update environment variables and restart the service"
        ],
        priority=Priority.CRITICAL,
        estimated_resolution_time="5-10 minutes",
        keywords=["authentication", "auth", "unauthorized", "forbidden", "credential", "permission", "denied"]
    ),
    
    "database_query_timeout": RemediationEntry(
        issue_category="database_query_timeout",
        description="Database query exceeded the timeout threshold. Long-running queries "
                   "or slow indexes are blocking operations.",
        fix_steps=[
            "Identify the slow query from application and database logs",
            "Check query execution plan using MongoDB's explain()",
            "Verify indexes exist on query fields (use createIndex if needed)",
            "Consider adding compound indexes for multi-field queries",
            "Check database CPU and memory utilization during the timeout",
            "Review data volume - large collections may need pagination",
            "Increase query timeout in application settings if intentional",
            "Archive old data if collection has grown too large"
        ],
        priority=Priority.HIGH,
        estimated_resolution_time="10-30 minutes",
        keywords=["timeout", "slow", "query", "execution", "lag", "delay", "database"]
    ),
    
    # ========== API AND SERVICE ISSUES ==========
    
    "api_timeout": RemediationEntry(
        issue_category="api_timeout",
        description="API gateway or downstream service did not respond within timeout period. "
                   "Service is experiencing latency or is unresponsive.",
        fix_steps=[
            "Check if the downstream service is running: verify service status/health endpoint",
            "Review service logs for errors or warnings that indicate failure",
            "Check network latency between services (use ping or traceroute)",
            "Review CPU and memory usage of the affected service",
            "Check for network congestion or packet loss",
            "Verify API timeout configuration is appropriate for the operation",
            "Check if the service is stuck on a database query (trace database logs)",
            "Restart the service if it appears hung or unresponsive",
            "Scale the service horizontally if under high load"
        ],
        priority=Priority.HIGH,
        estimated_resolution_time="5-20 minutes",
        keywords=["timeout", "504", "gateway", "deadline", "timed out", "no response", "unreachable"]
    ),
    
    "api_overload": RemediationEntry(
        issue_category="api_overload",
        description="API service received more requests than it can handle. Request queue "
                   "is growing and responses are delayed.",
        fix_steps=[
            "Check current request count and throughput in API metrics",
            "Identify if the spike is expected or anomalous",
            "Review API gateway rate limiting and queue sizes",
            "Check if a specific endpoint is receiving most requests",
            "Scale the service horizontally by adding more instances",
            "Temporarily reduce rate limits if system is at risk",
            "Optimize slow endpoints (check database queries)",
            "Consider caching responses if appropriate",
            "Enable load balancing across multiple instances"
        ],
        priority=Priority.HIGH,
        estimated_resolution_time="10-30 minutes",
        keywords=["overload", "too many", "queue", "congestion", "saturated", "busy", "load"]
    ),
    
    # ========== MEMORY AND RESOURCE ISSUES ==========
    
    "high_memory_usage": RemediationEntry(
        issue_category="high_memory_usage",
        description="Service is consuming excessive memory. Memory usage is above threshold "
                   "and may lead to service crash (OOM - Out of Memory).",
        fix_steps=[
            "Check current memory usage and limits using top/htop or container metrics",
            "Identify which process/thread is consuming memory (use profiling tools)",
            "Review application logs for memory-related errors or warnings",
            "Check for memory leaks in application code (unfreed objects, unclosed connections)",
            "Review database query result sizes - large datasets consume memory",
            "Check cache sizes and eviction policies",
            "Restart the service to free up memory temporarily",
            "Increase container memory limit if load is expected to grow",
            "Optimize memory usage in code or reduce data volume"
        ],
        priority=Priority.HIGH,
        estimated_resolution_time="15-45 minutes",
        keywords=["memory", "oom", "out of memory", "heap", "swap", "resource", "usage"]
    ),
    
    "cpu_overload": RemediationEntry(
        issue_category="cpu_overload",
        description="Service is consuming excessive CPU resources. CPU utilization is above "
                   "threshold and may cause latency or service degradation.",
        fix_steps=[
            "Check current CPU usage across all cores (top, htop, or cloud metrics)",
            "Identify CPU-intensive processes or operations",
            "Review application logs for intensive operations (batch jobs, calculations)",
            "Check if a specific request or query is causing the spike",
            "Optimize slow algorithms or queries if identified",
            "Reduce batch processing size or frequency",
            "Scale horizontally by adding more service instances",
            "Check for database lock contention or inefficient queries",
            "Enable request queuing to smooth out spikes"
        ],
        priority=Priority.HIGH,
        estimated_resolution_time="10-30 minutes",
        keywords=["cpu", "processor", "utilization", "overload", "intensive", "compute"]
    ),
    
    # ========== STORAGE AND DISK ISSUES ==========
    
    "disk_space_critical": RemediationEntry(
        issue_category="disk_space_critical",
        description="Disk space is critically low. Service may fail soon if space is not freed. "
                   "This is especially critical for database and log storage.",
        fix_steps=[
            "Check disk usage by mount point: df -h on Linux",
            "Identify large files and directories consuming space",
            "Clear application logs if they are consuming space (archive if needed)",
            "Clear temporary files and cache directories",
            "Identify and archive old or unused data from database",
            "Remove old container images and unused Docker volumes",
            "Increase disk capacity if permanently needed",
            "Enable log rotation to prevent logs from consuming all space",
            "Archive database backups to external storage"
        ],
        priority=Priority.CRITICAL,
        estimated_resolution_time="15-45 minutes",
        keywords=["disk", "space", "full", "storage", "quota", "fsck", "partition"]
    ),
    
    "hdfs_block_error": RemediationEntry(
        issue_category="hdfs_block_error",
        description="HDFS block read/write failure. Data block is corrupted, inaccessible, "
                   "or replication is incomplete.",
        fix_steps=[
            "Run HDFS health check: hdfs fsck / to identify bad blocks",
            "Verify all DataNode services are running and healthy",
            "Check DataNode logs for block corruption or I/O errors",
            "Run HDFS rebalancing to replicate lost blocks",
            "Increase replication factor if blocks are under-replicated",
            "Check network connectivity between NameNode and DataNodes",
            "Verify storage disks are healthy (check for bad sectors)",
            "If data loss is unrecoverable, restore from backup",
            "Monitor block reports from DataNodes"
        ],
        priority=Priority.CRITICAL,
        estimated_resolution_time="20-60 minutes",
        keywords=["hdfs", "block", "corruption", "datanode", "replica", "file", "replication"]
    ),
    
    # ========== SERVICE HEALTH ISSUES ==========
    
    "service_crash": RemediationEntry(
        issue_category="service_crash",
        description="Service crashed or became unavailable. Container or process exited "
                   "unexpectedly, likely due to error, OOM, or signal.",
        fix_steps=[
            "Check service status: systemctl status <service> or docker ps",
            "Review service logs for crash reason (OOM, exception, signal)",
            "Check system logs for resource issues (memory, disk, CPU)",
            "Verify dependencies are running (database, cache, other services)",
            "Restart the service: systemctl restart <service> or docker restart <container>",
            "If restart fails, check logs for configuration or dependency errors",
            "Verify all required environment variables are set",
            "Check application startup logs for initialization errors",
            "Review recent deployments or configuration changes"
        ],
        priority=Priority.CRITICAL,
        estimated_resolution_time="5-15 minutes",
        keywords=["crash", "crashed", "unavailable", "down", "failed", "exited", "stopped"]
    ),
    
    "service_unresponsive": RemediationEntry(
        issue_category="service_unresponsive",
        description="Service is running but not responding to requests. Likely deadlock, "
                   "infinite loop, or blocking operation.",
        fix_steps=[
            "Check if the service process is running (top, ps, or cloud metrics)",
            "Check service health endpoint to verify responsiveness",
            "Review service logs for stuck or blocking operations",
            "Check for database locks or slow queries that could be blocking",
            "Check thread dumps or stack traces for deadlock patterns",
            "Review recent request traffic and identified problematic requests",
            "Increase request timeouts temporarily to gather diagnostics",
            "Restart the service if it appears permanently stuck",
            "Check for circular dependencies between services"
        ],
        priority=Priority.CRITICAL,
        estimated_resolution_time="10-30 minutes",
        keywords=["unresponsive", "hanging", "stuck", "deadlock", "blocked", "frozen"]
    ),
    
    # ========== NETWORK AND CONNECTIVITY ISSUES ==========
    
    "network_connectivity_issue": RemediationEntry(
        issue_category="network_connectivity_issue",
        description="Network connectivity problem prevents service communication. "
                   "DNS resolution, routing, or firewall issues may be present.",
        fix_steps=[
            "Test basic network connectivity: ping hostname or IP",
            "Verify DNS resolution: nslookup or dig hostname",
            "Check if firewall rules allow communication on required ports",
            "Verify network interface is UP and has IP address: ip addr or ipconfig",
            "Check routing table for correct routes: ip route or route -n",
            "Verify VPN connection if applicable",
            "Check service port is listening: netstat -tlnp or ss -tlnp",
            "Review network security groups or iptables rules",
            "Check if ISP or cloud provider has network issues"
        ],
        priority=Priority.CRITICAL,
        estimated_resolution_time="10-25 minutes",
        keywords=["network", "connectivity", "dns", "unreachable", "no route", "connection refused", "host"]
    ),
    
    "dns_failure": RemediationEntry(
        issue_category="dns_failure",
        description="DNS resolution failed. Service cannot resolve hostname to IP address. "
                   "This prevents service discovery and inter-service communication.",
        fix_steps=[
            "Verify DNS server is reachable and responding",
            "Test DNS resolution manually: nslookup <hostname>",
            "Check /etc/resolv.conf for correct DNS server IPs",
            "Verify hostname DNS record exists and points to correct IP",
            "Check for DNS cache issues: flush if possible",
            "Verify DNS server has connectivity to authoritative servers",
            "Check DNS query logs for resolution errors",
            "Temporarily use IP address instead of hostname if needed",
            "Restart DNS resolver service if stuck"
        ],
        priority=Priority.HIGH,
        estimated_resolution_time="5-15 minutes",
        keywords=["dns", "resolution", "lookup", "nslookup", "hostname", "not found"]
    ),
    
    # ========== CONFIGURATION AND ENVIRONMENT ISSUES ==========
    
    "config_error": RemediationEntry(
        issue_category="config_error",
        description="Configuration or environment variable is missing, invalid, or malformed. "
                   "Service cannot start or behave unexpectedly due to wrong config.",
        fix_steps=[
            "Review application startup logs for config error messages",
            "Verify all required environment variables are set: env | grep VAR",
            "Check for typos in environment variable names",
            "Validate configuration file format (JSON, YAML, etc.)",
            "Ensure configuration values are within valid ranges",
            "Check for string encoding issues (special characters, UTF-8)",
            "Verify file paths in config exist and are accessible",
            "Review recent configuration changes or deployments",
            "Use config validation tools to check syntax",
            "Restart service after correcting configuration"
        ],
        priority=Priority.HIGH,
        estimated_resolution_time="5-20 minutes",
        keywords=["config", "configuration", "environment", "variable", "invalid", "missing", "env"]
    ),
    
    "permission_denied": RemediationEntry(
        issue_category="permission_denied",
        description="Service lacks permissions to access file, directory, or resource. "
                   "File ownership or permissions are incorrectly configured.",
        fix_steps=[
            "Check file/directory permissions: ls -l",
            "Verify service user matches file owner: id <user>",
            "Grant necessary permissions: chmod or chown as appropriate",
            "Ensure service runs with correct user context",
            "Check SELinux or AppArmor policies if enabled",
            "Verify service has access to required directories",
            "Check mount permissions if using mounted volumes",
            "Review logs for specific permission denied errors",
            "Apply principle of least privilege for security",
            "Restart service after permission changes"
        ],
        priority=Priority.MEDIUM,
        estimated_resolution_time="5-15 minutes",
        keywords=["permission", "denied", "access", "forbidden", "chmod", "ownership", "readable"]
    ),
    
    # ========== DEFAULT / UNKNOWN ISSUES ==========
    
    "unknown_error": RemediationEntry(
        issue_category="unknown_error",
        description="Unknown or uncategorized error. Insufficient information to provide "
                   "specific remediation. General troubleshooting steps recommended.",
        fix_steps=[
            "Review complete service logs for additional error context",
            "Check service health endpoint and status",
            "Verify all dependencies are running and healthy",
            "Check recent deployments or configuration changes",
            "Review system resource usage (CPU, memory, disk)",
            "Check network connectivity and firewall rules",
            "Enable debug logging if available in the service",
            "Correlate error with other services' logs for patterns",
            "Restart the service as a temporary mitigation",
            "Escalate to senior engineer if issue persists"
        ],
        priority=Priority.MEDIUM,
        estimated_resolution_time="15-45 minutes",
        keywords=[]
    ),
}


class RemediationMatcher:
    """
    Matches root causes to remediation guidance using keyword matching.
    
    Deterministic, rule-based matching without any ML or LLM calls.
    """
    
    @staticmethod
    def find_matching_remediation(
        service: str,
        message: str,
        root_cause_message: Optional[str] = None
    ) -> RemediationEntry:
        """
        Find the best matching remediation for a root cause.
        
        Uses keyword matching in service name and error message to find
        the most appropriate remediation entry. Falls back to unknown_error
        if no good match is found.
        
        Args:
            service: Service name where root cause occurred
            message: Root cause error message
            root_cause_message: Optional full root cause description
        
        Returns:
            RemediationEntry with fix steps and guidance
        """
        # Combine all available text for matching
        full_text = (
            f"{service} {message} {root_cause_message or ''}".lower()
        )
        
        # Score each remediation entry by keyword matches
        match_scores: Dict[str, int] = {}
        
        for category, entry in REMEDIATION_KB.items():
            # Count keyword matches (case-insensitive)
            score = sum(
                1 for keyword in entry.keywords
                if keyword.lower() in full_text
            )
            match_scores[category] = score
        
        # Find best match (highest score)
        best_match = max(match_scores.items(), key=lambda x: x[1])
        category, score = best_match
        
        # If no keyword matches, use unknown_error
        if score == 0:
            category = "unknown_error"
        
        return REMEDIATION_KB[category]
    
    @staticmethod
    def get_all_categories() -> List[str]:
        """
        Get list of all remediation categories.
        
        Returns:
            List of category identifiers
        """
        return list(REMEDIATION_KB.keys())
    
    @staticmethod
    def get_remediation_by_category(category: str) -> Optional[RemediationEntry]:
        """
        Get remediation entry by exact category name.
        
        Args:
            category: Category identifier
        
        Returns:
            RemediationEntry if found, None otherwise
        """
        return REMEDIATION_KB.get(category)
