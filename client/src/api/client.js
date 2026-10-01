import axios from 'axios';

// Base API URL
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor for attaching auth tokens if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('proctor_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Mock database for standalone demo/testing fallback
const mockExams = [
  {
    id: 'exam-cs301-2026',
    title: 'CS 301: Advanced Operating Systems & Systems Programming',
    window: '10:00 AM - 12:30 PM (IST)',
    scheduledStart: new Date(Date.now() - 3600000).toISOString(),
    scheduledEnd: new Date(Date.now() + 5400000).toISOString(),
    status: 'LIVE',
    candidateCount: 42,
    onlineCount: 39,
    flaggedCount: 5,
    proctorName: 'Tanya Goyal',
  },
  {
    id: 'exam-ee204-2026',
    title: 'EE 204: Signals and Digital Signal Processing',
    window: '02:00 PM - 04:00 PM (IST)',
    scheduledStart: new Date(Date.now() + 7200000).toISOString(),
    scheduledEnd: new Date(Date.now() + 14400000).toISOString(),
    status: 'UPCOMING',
    candidateCount: 65,
    onlineCount: 0,
    flaggedCount: 0,
    proctorName: 'Tanya Goyal',
  },
  {
    id: 'exam-ds102-2026',
    title: 'DS 102: Data Structures & Algorithms Midterm',
    window: 'Yesterday, 09:00 AM - 11:00 AM',
    scheduledStart: new Date(Date.now() - 86400000).toISOString(),
    scheduledEnd: new Date(Date.now() - 79200000).toISOString(),
    status: 'ENDED',
    candidateCount: 120,
    onlineCount: 0,
    flaggedCount: 14,
    proctorName: 'Tanya Goyal',
  }
];

const mockCandidates = [
  { id: 'sess-001', name: 'Aarav Sharma', email: 'aarav.sharma@univ.edu', candidateId: 'CS26-001', status: 'Online', focused: true, maxSeverity: 'HIGH', flagCount: 3, startedAt: '10:01 AM', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0' },
  { id: 'sess-002', name: 'Ananya Iyer', email: 'ananya.iyer@univ.edu', candidateId: 'CS26-002', status: 'Online', focused: true, maxSeverity: 'NONE', flagCount: 0, startedAt: '10:00 AM', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15' },
  { id: 'sess-003', name: 'Rohan Mehta', email: 'rohan.mehta@univ.edu', candidateId: 'CS26-003', status: 'Online', focused: false, maxSeverity: 'MED', flagCount: 2, startedAt: '10:02 AM', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/128.0' },
  { id: 'sess-004', name: 'Diya Patel', email: 'diya.patel@univ.edu', candidateId: 'CS26-004', status: 'Online', focused: true, maxSeverity: 'NONE', flagCount: 0, startedAt: '10:00 AM', userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/127.0' },
  { id: 'sess-005', name: 'Kabir Sen', email: 'kabir.sen@univ.edu', candidateId: 'CS26-005', status: 'Offline', focused: false, maxSeverity: 'LOW', flagCount: 1, startedAt: '10:05 AM', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/129.0' },
  { id: 'sess-006', name: 'Ishaan Verma', email: 'ishaan.verma@univ.edu', candidateId: 'CS26-006', status: 'Online', focused: true, maxSeverity: 'HIGH', flagCount: 4, startedAt: '10:00 AM', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0' },
  { id: 'sess-007', name: 'Pooja Reddy', email: 'pooja.reddy@univ.edu', candidateId: 'CS26-007', status: 'Online', focused: true, maxSeverity: 'NONE', flagCount: 0, startedAt: '10:03 AM', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) Chrome/128.0' },
  { id: 'sess-008', name: 'Karan Malhotra', email: 'karan.m@univ.edu', candidateId: 'CS26-008', status: 'Online', focused: true, maxSeverity: 'MED', flagCount: 1, startedAt: '10:01 AM', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0' },
  { id: 'sess-009', name: 'Sneha Mukherjee', email: 'sneha.m@univ.edu', candidateId: 'CS26-009', status: 'Online', focused: false, maxSeverity: 'LOW', flagCount: 1, startedAt: '10:02 AM', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0' },
  { id: 'sess-010', name: 'Vikram Joshi', email: 'vikram.j@univ.edu', candidateId: 'CS26-010', status: 'Ended', focused: true, maxSeverity: 'NONE', flagCount: 0, startedAt: '10:00 AM', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) Safari/605.1' },
];

// Generate extra candidates to demonstrate virtualization (up to 42 candidates)
for (let i = 11; i <= 42; i++) {
  const paddedId = String(i).padStart(3, '0');
  mockCandidates.push({
    id: `sess-${paddedId}`,
    name: `Student Candidate ${i}`,
    email: `candidate.${paddedId}@univ.edu`,
    candidateId: `CS26-${paddedId}`,
    status: i % 7 === 0 ? 'Offline' : 'Online',
    focused: i % 9 !== 0,
    maxSeverity: i === 15 ? 'MED' : (i === 28 ? 'LOW' : 'NONE'),
    flagCount: i === 15 ? 1 : (i === 28 ? 1 : 0),
    startedAt: '10:00 AM',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0'
  });
}

const mockFlags = [
  {
    id: 'flag-101',
    sessionId: 'sess-001',
    candidateName: 'Aarav Sharma',
    code: 'OVERLAY_DETECTED',
    plainCode: 'Browser Overlay Detected (Alt+O Demo)',
    severity: 'HIGH',
    score: 0.98,
    createdAt: new Date(Date.now() - 45000).toISOString(),
    reviewed: false,
    verdict: null,
    note: '',
    evidence: [
      { code: 'TRANSPARENT_WINDOW_LAYER', severity: 'HIGH', meta: 'Always-On-Top Layer detected with DirectComposition' },
      { code: 'PROCESS_TITLE_MATCH', severity: 'HIGH', meta: 'Process hook: overlay_helper.exe (size: 640x480)' },
      { code: 'SHORTCUT_TRIGGER', severity: 'MED', meta: 'Shortcut intercepted: Alt+O' }
    ]
  },
  {
    id: 'flag-102',
    sessionId: 'sess-006',
    candidateName: 'Ishaan Verma',
    code: 'MULTIPLE_DISPLAYS_ACTIVE',
    plainCode: 'Secondary Virtual Display / Screen Mirroring',
    severity: 'HIGH',
    score: 0.92,
    createdAt: new Date(Date.now() - 120000).toISOString(),
    reviewed: false,
    verdict: null,
    note: '',
    evidence: [
      { code: 'SCREEN_COUNT_CHANGE', severity: 'HIGH', meta: 'Display adapter registered 2 screens (HDMI-1 + Virtual-0)' },
      { code: 'WINDOW_BOUNDS_OVERFLOW', severity: 'MED', meta: 'Cursor position exited primary viewport coordinates' }
    ]
  },
  {
    id: 'flag-103',
    sessionId: 'sess-003',
    candidateName: 'Rohan Mehta',
    code: 'WINDOW_BLUR_PERSISTENT',
    plainCode: 'Window Lost Focus (>15s)',
    severity: 'MED',
    score: 0.74,
    createdAt: new Date(Date.now() - 240000).toISOString(),
    reviewed: true,
    verdict: 'SUSPICIOUS',
    note: 'Candidate switched window during Question 4',
    evidence: [
      { code: 'FOCUS_OUT_EVENT', severity: 'MED', meta: 'document.hidden=true for 18.4 seconds' },
      { code: 'CLIPBOARD_PASTE', severity: 'LOW', meta: 'Paste event registered right after refocus' }
    ]
  },
  {
    id: 'flag-104',
    sessionId: 'sess-008',
    candidateName: 'Karan Malhotra',
    code: 'BROWSER_EXTENSION_INJECTION',
    plainCode: 'Grammarly / AI Assistant DOM Modification',
    severity: 'MED',
    score: 0.65,
    createdAt: new Date(Date.now() - 360000).toISOString(),
    reviewed: true,
    verdict: 'CLEARED',
    note: 'Standard Grammarly extension allowed per syllabus policy',
    evidence: [
      { code: 'DOM_MUTATION_SHADOW', severity: 'MED', meta: 'Injected node: <grammarly-extension>' },
      { code: 'EXTENSION_ID_MATCH', severity: 'LOW', meta: 'Chrome Web Store ID: kbfnbcaehmannpehhgojpgflpaennmma' }
    ]
  },
  {
    id: 'flag-105',
    sessionId: 'sess-005',
    candidateName: 'Kabir Sen',
    code: 'NETWORK_DISCONNECT',
    plainCode: 'Socket Disconnected Abruptly',
    severity: 'LOW',
    score: 0.40,
    createdAt: new Date(Date.now() - 500000).toISOString(),
    reviewed: false,
    verdict: null,
    note: '',
    evidence: [
      { code: 'HEARTBEAT_TIMEOUT', severity: 'LOW', meta: 'No ping ack for 30,000ms' }
    ]
  }
];

// Fallback interceptor when backend is offline or mock fallback is enabled
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isMock = import.meta.env.VITE_MOCK_FALLBACK !== 'false';
    const config = error.config;

    if (isMock && (error.code === 'ERR_NETWORK' || !error.response || error.response.status === 404)) {
      const url = config.url || '';
      console.warn(`[API Mock Fallback] Serving mock response for: ${config.method?.toUpperCase()} ${url}`);

      // GET /exams
      if (url === '/exams' || url === '/api/exams') {
        return Promise.resolve({ data: mockExams, status: 200 });
      }

      // GET /exams/:id/sessions
      if (url.includes('/sessions')) {
        return Promise.resolve({ data: mockCandidates, status: 200 });
      }

      // GET /exams/:id/report/csv
      if (url.includes('/report/csv')) {
        const csvHeader = 'Candidate ID,Candidate Name,Email,Status,Max Severity,Flag Count,Started At\n';
        const csvRows = mockCandidates.map(c => `"${c.candidateId}","${c.name}","${c.email}","${c.status}","${c.maxSeverity}",${c.flagCount},"${c.startedAt}"`).join('\n');
        const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
        return Promise.resolve({ data: blob, status: 200 });
      }

      // GET /exams/:id/report
      if (url.includes('/report')) {
        return Promise.resolve({
          data: {
            exam: mockExams[0],
            totals: {
              totalCandidates: 42,
              onlineCount: 39,
              totalFlags: 11,
              highSeverityCount: 4,
              medSeverityCount: 4,
              lowSeverityCount: 3,
              cleanCompletionRate: '88.1%'
            },
            flagsByCode: [
              { code: 'OVERLAY_DETECTED', count: 4, label: 'Browser Overlay' },
              { code: 'WINDOW_BLUR', count: 3, label: 'Focus Lost' },
              { code: 'MULTIPLE_DISPLAYS', count: 2, label: 'Secondary Screen' },
              { code: 'EXTENSION_DOM', count: 1, label: 'AI/Extension' },
              { code: 'DEVTOOLS_OPEN', count: 1, label: 'DevTools' }
            ],
            flagsBySeverity: [
              { severity: 'HIGH', count: 4, fill: '#f43f5e' },
              { severity: 'MED', count: 4, fill: '#f59e0b' },
              { severity: 'LOW', count: 3, fill: '#0ea5e9' }
            ],
            candidateSummaries: mockCandidates
          },
          status: 200
        });
      }

      // GET /exams/:id
      if (url.startsWith('/exams/')) {
        const examId = url.split('/')[2];
        const exam = mockExams.find(e => e.id === examId) || mockExams[0];
        return Promise.resolve({ data: exam, status: 200 });
      }

      // GET /sessions/:id/flags
      if (url.includes('/flags') && config.method === 'get') {
        const parts = url.split('/');
        const sessionId = parts[2];
        const flags = mockFlags.filter(f => f.sessionId === sessionId);
        return Promise.resolve({ data: flags.length > 0 ? flags : [mockFlags[0]], status: 200 });
      }

      // GET /sessions/:id
      if (url.startsWith('/sessions/')) {
        const sessionId = url.split('/')[2];
        const candidate = mockCandidates.find(c => c.id === sessionId) || mockCandidates[0];
        return Promise.resolve({ data: candidate, status: 200 });
      }

      // PATCH /flags/:id
      if (url.startsWith('/flags/') && config.method === 'patch') {
        const payload = JSON.parse(config.data || '{}');
        return Promise.resolve({
          data: { success: true, updated: payload, timestamp: new Date().toISOString() },
          status: 200
        });
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
