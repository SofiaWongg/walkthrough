import { Property, Walkthrough, InProgressChecklist, ChecklistResult } from '../types/walkthrough';

// Simulated delay for API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock data
const mockProperties: Property[] = [
  { id: '1', name: '123 Oak Street, San Francisco, CA 94102' },
  { id: '2', name: '456 Pine Avenue, San Francisco, CA 94103' },
  { id: '3', name: '789 Maple Drive, San Francisco, CA 94104' },
];

const mockWalkthroughs: Walkthrough[] = [
  {
    id: 'w1',
    propertyId: '1',
    propertyName: '123 Oak Street, San Francisco, CA 94102',
    createdAt: new Date('2025-04-10T10:30:00'),
    transcript: 'Entered front door. Living room looks good. Kitchen has minor wear on countertops...',
    checklist: {
      'Front Door': { is_new: false, is_missing: false, todos: [] },
      'Living Room': { is_new: false, is_missing: false, todos: [] },
      'Kitchen': { is_new: false, is_missing: false, todos: ['Check countertop wear', 'Consider refinishing'] },
      'Master Bedroom': { is_new: false, is_missing: true, todos: [] },
      'Garage': { is_new: true, is_missing: false, todos: ['Inspect door mechanism'] },
    },
    status: 'completed',
  },
  {
    id: 'w2',
    propertyId: '2',
    propertyName: '456 Pine Avenue, San Francisco, CA 94103',
    createdAt: new Date('2025-04-08T14:00:00'),
    transcript: 'Starting walkthrough of Pine Avenue property...',
    checklist: {
      'Entryway': { is_new: false, is_missing: false, todos: [] },
      'Bathroom': { is_new: false, is_missing: false, todos: ['Fix leaky faucet'] },
    },
    status: 'completed',
  },
];

// Session storage for in-progress walkthroughs
let activeSessions: Map<string, {
  propertyId: string;
  propertyName: string;
  transcript: string;
  checklist: InProgressChecklist;
}> = new Map();

let sessionCounter = 0;

// Mock base checklist items that would come from backend
const baseChecklistItems = [
  'Front Door',
  'Living Room',
  'Kitchen',
  'Master Bedroom',
  'Bathroom',
  'Backyard',
];

export async function getProperties(): Promise<Property[]> {
  await delay(300);
  return mockProperties;
}

export async function startSession(propertyId: string, propertyName: string): Promise<{ sessionId: string }> {
  await delay(200);
  sessionCounter++;
  const sessionId = `session_${sessionCounter}_${Date.now()}`;

  activeSessions.set(sessionId, {
    propertyId,
    propertyName,
    transcript: '',
    checklist: {
      items: baseChecklistItems.map(name => ({ name, completed: false })),
    },
  });

  return { sessionId };
}

export async function processChunk(
  sessionId: string,
  transcriptChunk: string
): Promise<InProgressChecklist> {
  await delay(500);

  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // Append to transcript
  session.transcript += (session.transcript ? ' ' : '') + transcriptChunk;

  // Simple mock logic: mark items as completed if mentioned in transcript
  const lowerTranscript = session.transcript.toLowerCase();
  session.checklist.items = session.checklist.items.map(item => ({
    ...item,
    completed: item.completed || lowerTranscript.includes(item.name.toLowerCase()),
  }));

  // Add new items if certain keywords are detected
  const newItemKeywords = ['garage', 'attic', 'basement', 'patio', 'deck'];
  for (const keyword of newItemKeywords) {
    if (lowerTranscript.includes(keyword)) {
      const itemName = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      if (!session.checklist.items.some(i => i.name === itemName)) {
        session.checklist.items.push({ name: itemName, completed: true });
      }
    }
  }

  return session.checklist;
}

export async function validateWalkthrough(sessionId: string): Promise<ChecklistResult> {
  await delay(800);

  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // Generate mock validation result
  const result: ChecklistResult = {};

  for (const item of session.checklist.items) {
    const isBaseItem = baseChecklistItems.includes(item.name);
    result[item.name] = {
      is_new: !isBaseItem,
      is_missing: isBaseItem && !item.completed,
      todos: generateMockTodos(item.name, item.completed),
    };
  }

  // Add any base items that weren't in the checklist as missing
  for (const baseName of baseChecklistItems) {
    if (!result[baseName]) {
      result[baseName] = {
        is_new: false,
        is_missing: true,
        todos: [],
      };
    }
  }

  return result;
}

function generateMockTodos(itemName: string, completed: boolean): string[] {
  if (!completed) return [];

  // Generate some mock todos based on item name
  const todoMap: Record<string, string[]> = {
    'Kitchen': ['Check appliance conditions', 'Inspect countertops for damage'],
    'Bathroom': ['Test water pressure', 'Check for leaks under sink'],
    'Living Room': ['Note carpet condition', 'Check window seals'],
    'Front Door': ['Test lock mechanism', 'Check weather stripping'],
    'Master Bedroom': ['Inspect closet space', 'Check outlets'],
    'Backyard': ['Review fence condition', 'Check drainage'],
    'Garage': ['Test garage door opener', 'Check floor for cracks'],
    'Attic': ['Check insulation', 'Look for water damage'],
    'Basement': ['Check for moisture', 'Inspect foundation walls'],
  };

  return todoMap[itemName] || [];
}

export async function getWalkthroughs(): Promise<Walkthrough[]> {
  await delay(300);
  return mockWalkthroughs;
}

export async function saveWalkthrough(
  sessionId: string,
  checklistResult: ChecklistResult
): Promise<Walkthrough> {
  await delay(300);

  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const walkthrough: Walkthrough = {
    id: `w_${Date.now()}`,
    propertyId: session.propertyId,
    propertyName: session.propertyName,
    createdAt: new Date(),
    transcript: session.transcript,
    checklist: checklistResult,
    status: 'completed',
  };

  // Add to mock walkthroughs
  mockWalkthroughs.unshift(walkthrough);

  // Clean up session
  activeSessions.delete(sessionId);

  return walkthrough;
}
