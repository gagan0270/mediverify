
import React from 'react';
import { VerificationResult, MatchStatus } from '../types';
import { Card, Badge } from '../components/UI';

interface HistoryProps {
  history: VerificationResult[];
}

const History: React.FC<HistoryProps> = ({ history }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-2">
         <h1 className="text-3xl font-black text-slate-900">Verification History</h1>
         <Badge color="blue">{history.length} Total Records</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {history.map(item => (
          <Card key={item.id} className="group hover:border-blue-200 transition-colors">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <p className="text-xs text-slate-400 font-black uppercase">{new Date(item.timestamp).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                <Badge color={item.status === MatchStatus.PERFECT_MATCH ? 'green' : 'red'}>
                   {item.status.replace('_', ' ')}
                </Badge>
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-800">{item.identifiedTablet.name}</h3>
                <p className="text-sm font-bold text-slate-400">Dr. {item.prescription.doctorName}</p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <div className="flex-grow h-2 bg-slate-100 rounded-full overflow-hidden">
                   <div className={`h-full transition-all duration-1000 ${
                     item.matchScore > 0.8 ? 'bg-green-500' : item.matchScore > 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                   }`} style={{ width: `${item.matchScore * 100}%` }}></div>
                </div>
                <span className="text-xs font-black text-slate-400">{(item.matchScore * 100).toFixed(0)}%</span>
              </div>

              {item.alerts && item.alerts.length > 0 && (
                <div className="pt-3 border-t border-slate-50">
                   <p className="text-[10px] font-black text-slate-300 uppercase mb-2">Warnings Found</p>
                   <div className="space-y-2">
                      {item.alerts.slice(0, 2).map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-500">
                           <i className={`fas fa-circle text-[6px] ${a.type === 'CRITICAL' ? 'text-red-500' : 'text-blue-500'}`}></i>
                           <span className="truncate">{a.title}</span>
                        </div>
                      ))}
                      {item.alerts.length > 2 && <p className="text-[10px] font-bold text-blue-500">+{item.alerts.length - 2} more alerts</p>}
                   </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {history.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-300">
           <i className="fas fa-history text-6xl mb-4"></i>
           <p className="text-xl font-bold">Your verification history is empty</p>
           <p className="text-sm">Start by checking your first medicine</p>
        </div>
      )}
    </div>
  );
};

export default History;
