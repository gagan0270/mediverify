
import React from 'react';
import { VerificationResult, MatchStatus } from '../types';
import { Card, Badge } from '../components/UI';
import { useLanguage } from '../App';

interface HistoryProps {
  history: VerificationResult[];
}

const History: React.FC<HistoryProps> = ({ history }) => {
  const { t } = useLanguage();
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-2">
         <h1 className="text-3xl font-black text-slate-900 dark:text-white">{t.history_title}</h1>
         <Badge color="blue">{(history || []).length} {t.total_checks}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(history || []).map((item, idx) => (
          <Card key={item.id || idx} className="dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <p className="text-xs text-slate-400 font-black uppercase">
                  {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : '...'}
                </p>
                <Badge color={item.status === MatchStatus.PERFECT_MATCH ? 'green' : 'red'}>
                   {(item.status || '...').replace('_', ' ')}
                </Badge>
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 truncate">{item.identifiedTablets?.[0]?.name}</h3>
              <div className="flex items-center gap-2 pt-2">
                <div className="flex-grow h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                   <div className="h-full bg-blue-500" style={{ width: `${(item.matchScore || 0) * 100}%` }}></div>
                </div>
                <span className="text-xs font-black text-slate-400">{((item.matchScore || 0) * 100).toFixed(0)}%</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {(!history || history.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-300">
           <i className="fas fa-history text-6xl mb-4"></i>
           <p className="text-xl font-bold">{t.history_empty}</p>
        </div>
      )}
    </div>
  );
};

export default History;
