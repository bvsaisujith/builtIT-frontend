-- Migration 012: PPT submission via Google Drive link
-- Teams share a Google Drive link instead of uploading the deck directly.
-- Legacy file-upload columns (ppt_file_path / ppt_file_name) are kept so old
-- submissions keep rendering, but new submissions only set ppt_drive_url.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS ppt_drive_url text;

COMMENT ON COLUMN public.submissions.ppt_drive_url IS
  'Google Drive share link of the presentation (replaces direct file upload).';
