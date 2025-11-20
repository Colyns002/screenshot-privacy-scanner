import React from 'react';
import { RiskItem, RiskLevel } from '../types';
import { AlertTriangle, AlertCircle, CheckCircle, Eye, EyeOff, Trash2 } from 'lucide-react';

interface Props {
  summary: string;
  risks: RiskItem[];
  onToggleRedaction: (id: string) => void;
  onToggleVisibility: (id: string) => void;
}

const AnalysisSidebar: React.FC<Props> = ({ summary, risks, onToggleRedaction, onToggleVisibility }) => {
  
  const getIcon = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.HIGH: return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case RiskLevel.MEDIUM: return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case RiskLevel.LOW: return <AlertCircle className="w-5 h-5 text-blue-400" />;
      default: return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
  };

  const getColor = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.HIGH: return 'border-red-500/50 bg-red-500/10';
      case RiskLevel.MEDIUM: return 'border-yellow-500/50 bg-yellow-500/10';
      case RiskLevel.LOW: return 'border-blue-500/50 bg-blue-500/10';
      default: return 'border-green-500/50 bg-green-500/10';
    }
  };

  const visibleRisks = risks.filter(r => !r.isHidden);
  const hiddenRisks = risks.filter(r => r.isHidden);

  return (
    <div className="h-full flex flex-col bg-gray-800 border-l border-gray-700 w-full lg:w-96 flex-shrink-0 overflow-hidden">
      <div className="p-6 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-2">Analysis Report</h2>
        <p className="text-sm text-gray-400 leading-relaxed">{summary}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Detected Risks ({visibleRisks.length})</h3>
        </div>

        {visibleRisks.length === 0 && hiddenRisks.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No risks detected. Great!</p>
          </div>
        )}

        {visibleRisks.map((risk) => (
          <div 
            key={risk.id} 
            className={`p-3 rounded-lg border ${getColor(risk.riskLevel)} transition-all hover:bg-opacity-20`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="mt-0.5">{getIcon(risk.riskLevel)}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-200">{risk.type}</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-900/50 text-gray-400 border border-gray-700">
                    {risk.riskLevel}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{risk.description}</p>
                
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => onToggleRedaction(risk.id)}
                    className={`flex-1 text-xs py-1.5 px-3 rounded flex items-center justify-center gap-1.5 transition-colors ${
                      risk.isRedacted 
                      ? 'bg-gray-900 text-white border border-gray-600' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {risk.isRedacted ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {risk.isRedacted ? 'Redacted' : 'Redact'}
                  </button>
                  <button 
                     onClick={() => onToggleVisibility(risk.id)}
                     className="p-1.5 text-gray-500 hover:text-gray-300 rounded hover:bg-gray-700"
                     title="Ignore this risk"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {hiddenRisks.length > 0 && (
            <div className="mt-6 border-t border-gray-700 pt-4">
                 <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Ignored ({hiddenRisks.length})</h3>
                 {hiddenRisks.map(risk => (
                     <div key={risk.id} className="flex items-center justify-between p-2 text-xs text-gray-500 bg-gray-900/30 rounded mb-1">
                         <span>{risk.type}</span>
                         <button onClick={() => onToggleVisibility(risk.id)} className="text-blue-400 hover:underline">Restore</button>
                     </div>
                 ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisSidebar;