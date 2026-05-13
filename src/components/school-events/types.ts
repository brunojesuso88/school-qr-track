export interface SchoolEventSimple {
  id: string;
  name: string;
  event_date: string | null;
  description: string;
  cover_image: string | null;
  images: string[];
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const emptySchoolEvent: Omit<SchoolEventSimple, 'id'> = {
  name: '',
  event_date: null,
  description: '',
  cover_image: null,
  images: [],
};