/**
 * SentinelAI Dashboard - Data Table Component
 * ============================================
 * 
 * A reusable, styled data table for displaying anomalies and root causes.
 */

import React from 'react';
import './DataTable.css';

/**
 * Generic data table component.
 * 
 * @param {Object} props
 * @param {Array} props.columns - Column definitions [{ key, label, render? }]
 * @param {Array} props.data - Array of data objects
 * @param {string} props.emptyMessage - Message when no data
 * @param {Function} props.onRowClick - Optional row click handler
 */
export const DataTable = ({ 
  columns = [], 
  data = [], 
  emptyMessage = 'No data available',
  onRowClick 
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="table-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.className}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr 
              key={row.id || row._id || rowIndex}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'clickable' : ''}
            >
              {columns.map((col) => (
                <td key={col.key} className={col.className}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
