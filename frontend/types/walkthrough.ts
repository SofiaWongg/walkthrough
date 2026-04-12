export interface Property {
  id: string;
  name: string; // address
}

export interface Walkthrough {
  id: string;
  propertyId: string;
  propertyName: string;
  createdAt: Date;
  transcript: string;
  checklist: ChecklistResult;
  status: 'in_progress' | 'completed';
}

export interface ChecklistResult {
  [itemName: string]: {
    is_new: boolean;
    is_missing: boolean;
    todos: string[];
  };
}

export interface InProgressChecklist {
  items: Array<{
    name: string;
    completed: boolean;
  }>;
}

export interface WalkthroughSession {
  sessionId: string;
  propertyId: string;
  propertyName: string;
  transcript: string;
  inProgressChecklist: InProgressChecklist;
}
