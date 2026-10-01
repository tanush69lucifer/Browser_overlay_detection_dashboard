import React, { useState, useMemo, forwardRef } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
import useLiveStore from '../../store/live';
import SessionTile from './SessionTile';
import { Search, Filter, AlertTriangle, WifiOff, Users } from 'lucide-react';

const GridList = forwardRef(({ style, children, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    style={{ ...style }}
    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 p-1 pb-16"
  >
    {children}
  </div>
));

GridList.displayName = 'GridList';

const GridItem = ({ children, ...props }) => (
  <div {...props} className="w-full">
    {children}
  </div>
);

export default function SessionGrid() {
  const order = useLiveStore((state) => state.order);
  const sessions = useLiveStore((state) => state.sessions);

  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'FLAGGED' | 'OFFLINE'
  const [searchTerm, setSearchTerm] = useState('');

  // Filtered session IDs for virtualization
  const filteredOrder = useMemo(() => {
    return order.filter((id) => {
      const session = sessions[id];
      if (!session) return false;

      // Filter chip checks
      if (activeFilter === 'FLAGGED') {
        const isFlagged = session.flagCount > 0 || (session.maxSeverity && session.maxSeverity !== 'NONE');
        if (!isFlagged) return false;
      } else if (activeFilter === 'OFFLINE') {
        if (session.status === 'Online') return false;
      }

      // Name / Candidate ID search check
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = session.name?.toLowerCase().includes(query);
        const matchesId = session.candidateId?.toLowerCase().includes(query) || session.id?.toLowerCase().includes(query);
        const matchesEmail = session.email?.toLowerCase().includes(query);
        if (!matchesName && !matchesId && !matchesEmail) return false;
      }

      return true;
    });
  }, [order, sessions, activeFilter, searchTerm]);

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Control Bar: Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111827] p-2.5 rounded-lg border border-[#1e293b]">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
              activeFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>All Candidates</span>
            <span className="num text-[11px] opacity-80">({order.length})</span>
          </button>

          <button
            onClick={() => setActiveFilter('FLAGGED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
              activeFilter === 'FLAGGED'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Flagged</span>
          </button>

          <button
            onClick={() => setActiveFilter('OFFLINE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
              activeFilter === 'OFFLINE'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <WifiOff className="w-3.5 h-3.5 text-slate-400" />
            <span>Offline</span>
          </button>
        </div>

        {/* Candidate Search Box */}
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search candidate or ID..."
            className="w-full bg-[#0b0f17] border border-[#1e293b] rounded-md pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Virtualized Grid */}
      <div className="flex-1 min-h-[500px]">
        {filteredOrder.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-[#1e293b] rounded-lg text-slate-500 text-xs">
            <Filter className="w-8 h-8 mb-2 opacity-50" />
            <p>No candidate sessions match the selected filter.</p>
          </div>
        ) : (
          <VirtuosoGrid
            style={{ height: 'calc(100vh - 180px)' }}
            totalCount={filteredOrder.length}
            components={{
              List: GridList,
              Item: GridItem,
            }}
            itemContent={(index) => {
              const sessionId = filteredOrder[index];
              return <SessionTile key={sessionId} sessionId={sessionId} />;
            }}
          />
        )}
      </div>
    </div>
  );
}
