export interface Property {
  id: string;
  name: string;
  base_checklist_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  name: string;
}

export interface BaseChecklist {
  id: string;
  property_id: string;
  item_list: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

export interface PropertyDetail extends Property {
  walkthroughs: WalkthroughSummary[];
  base_checklist: BaseChecklist | null;
}

export type WalkthroughStatus = 'active' | 'completed';
export type WalkthroughItemStatus = 'checked' | 'unchecked';

export interface WalkthroughItem {
  id: string;
  walkthrough_id: string;
  checklist_item_id: string | null;
  name: string;
  status: WalkthroughItemStatus;
  notes: string | null;
  is_from_base: boolean;
}

export interface Walkthrough {
  id: string;
  property_id: string;
  item_list: WalkthroughItem[];
  status: WalkthroughStatus;
  transcript: { chunk: string }[];
  created_at: string;
  updated_at: string;
}

export interface WalkthroughSummary {
  id: string;
  status: WalkthroughStatus;
  created_at: string;
  updated_at: string;
}
