# HDFS Log Dataset

This directory contains HDFS log data for anomaly detection training.

## Expected File

- `HDFS.log` - Raw HDFS log file

## Log Format

Each line follows this format:
```
YYMMDD HHMMSS THREAD_ID LEVEL SERVICE: MESSAGE
```

Example:
```
081109 203518 148 INFO dfs.DataNode$DataXceiver: Receiving block blk_-1608999687919862906 src: /10.251.73.220:39713 dest: /10.251.73.220:50010
081109 203518 148 INFO dfs.DataNode$DataXceiver: Receiving block blk_-1608999687919862906 src: /10.251.73.220:39713 dest: /10.251.73.220:50010
081109 203519 35 INFO dfs.FSNamesystem: BLOCK* NameSystem.allocateBlock: /mnt/hadoop/mapred/system/job_200811092030_0001/job.jar. blk_-1608999687919862906
```

## Data Source

HDFS logs are commonly used for log anomaly detection research. Popular sources:
- [Loghub Dataset](https://github.com/logpai/loghub)
- [HDFS Dataset from LogHub](https://zenodo.org/record/3227177)

## Ingestion

Run the ingestion script to load logs into MongoDB:

```bash
cd SentinelAI
python scripts/ingest_hdfs_logs.py
```

The script will:
1. Parse each log line
2. Convert to SentinelAI log schema
3. Batch insert into MongoDB `logs` collection
4. Print progress and summary statistics
