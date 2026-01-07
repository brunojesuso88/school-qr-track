import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Cache for signed URLs to avoid unnecessary requests
const urlCache = new Map<string, { url: string; expiresAt: number }>();

// Extract file name from a photo URL (handles both public and signed URLs)
const extractFileName = (photoUrl: string): string | null => {
  if (!photoUrl) return null;
  
  try {
    const url = new URL(photoUrl);
    const pathParts = url.pathname.split('/');
    // The filename is typically the last part of the path
    const fileName = pathParts[pathParts.length - 1];
    // Remove any query parameters from the filename
    return fileName.split('?')[0];
  } catch {
    // If it's just a filename, return it directly
    return photoUrl;
  }
};

export const useSignedPhotoUrl = (photoUrl: string | null) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!photoUrl) {
        setSignedUrl(null);
        return;
      }

      const fileName = extractFileName(photoUrl);
      if (!fileName) {
        setSignedUrl(null);
        return;
      }

      // Check cache first
      const cached = urlCache.get(fileName);
      if (cached && cached.expiresAt > Date.now()) {
        setSignedUrl(cached.url);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('student-photos')
          .createSignedUrl(fileName, 3600); // 1 hour expiration

        if (error) {
          // If signed URL fails, the bucket might still be public or file doesn't exist
          console.warn('Could not create signed URL:', error.message);
          setSignedUrl(null);
        } else if (data?.signedUrl) {
          // Cache the signed URL
          urlCache.set(fileName, {
            url: data.signedUrl,
            expiresAt: Date.now() + 3500 * 1000 // Cache for slightly less than expiration
          });
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.warn('Error fetching signed URL:', err);
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [photoUrl]);

  return { signedUrl, loading };
};

// Utility function to get signed URL for a photo (for use outside of React components)
export const getSignedPhotoUrl = async (photoUrl: string | null): Promise<string | null> => {
  if (!photoUrl) return null;

  const fileName = extractFileName(photoUrl);
  if (!fileName) return null;

  // Check cache first
  const cached = urlCache.get(fileName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    const { data, error } = await supabase.storage
      .from('student-photos')
      .createSignedUrl(fileName, 3600);

    if (error || !data?.signedUrl) {
      return null;
    }

    // Cache the signed URL
    urlCache.set(fileName, {
      url: data.signedUrl,
      expiresAt: Date.now() + 3500 * 1000
    });

    return data.signedUrl;
  } catch {
    return null;
  }
};

// Clear the URL cache (useful when photos are updated)
export const clearPhotoUrlCache = () => {
  urlCache.clear();
};
