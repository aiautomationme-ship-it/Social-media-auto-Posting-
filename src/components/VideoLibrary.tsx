import React, { useState, useRef, useMemo } from 'react';
import {
  UploadCloud,
  Film,
  Trash2,
  Play,
  X,
  FileVideo,
  AlertCircle,
  HardDrive,
  Check,
  Search,
  Pencil,
  RefreshCw,
  FolderOpen,
  Calendar,
} from 'lucide-react';
import type { VideoRecord } from '../types/index.ts';

interface UploadProgressState {
  percentage: number;
  speedFormatted: string;
  loadedFormatted: string;
  totalFormatted: string;
  currentFileIndex: number;
  totalFiles: number;
  currentFileName: string;
  status: 'uploading' | 'saving' | 'done';
}

interface VideoLibraryProps {
  videos: VideoRecord[];
  onUploadVideos: (
    files: File[],
    onProgress?: (info: {
      loaded: number;
      total: number;
      percentage: number;
      speedFormatted: string;
      loadedFormatted: string;
      totalFormatted: string;
      currentFileIndex: number;
      totalFiles: number;
      currentFileName: string;
    }) => void
  ) => Promise<void>;
  onDeleteVideo: (videoId: string) => Promise<void>;
  onUpdateVideo?: (videoId: string, originalName: string) => Promise<void>;
  onReplaceVideo?: (videoId: string, file: File) => Promise<void>;
  onSelectVideoForPost?: (video: VideoRecord) => void;
  isLoading?: boolean;
}

type SortOption = 'newest' | 'oldest' | 'size_desc' | 'size_asc' | 'alpha';

export const VideoLibrary: React.FC<VideoLibraryProps> = ({
  videos,
  onUploadVideos,
  onDeleteVideo,
  onUpdateVideo,
  onReplaceVideo,
  onSelectVideoForPost,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Search, Filter, Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | 'mp4' | 'mov' | 'webm'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Modals state
  const [selectedPreviewVideo, setSelectedPreviewVideo] = useState<VideoRecord | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<VideoRecord | null>(null);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  const [videoToEdit, setVideoToEdit] = useState<VideoRecord | null>(null);
  const [editNameInput, setEditNameInput] = useState('');

  // Replace video modal state
  const [videoToReplace, setVideoToReplace] = useState<VideoRecord | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replaceModalError, setReplaceModalError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);

  // Hidden file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const isEmpty = videos.length === 0;

  // Validation & High-Speed Upload logic
  const validateAndUpload = async (files: FileList | File[]) => {
    const validFiles: File[] = [];
    const allowedExtensions = ['mp4', 'mov', 'webm', 'avi', 'mkv'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !allowedExtensions.includes(ext)) {
        setUploadError(`File "${file.name}" is not a supported video format (MP4, MOV, WEBM).`);
        return;
      }
      // Cloud Run / Serverless request payload maximum limit is 32MB per HTTP request
      if (file.size > 32 * 1024 * 1024) {
        setUploadError(
          `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Cloud Run proxy limits individual uploads to 32MB. Please upload videos under 32MB.`
        );
        return;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    try {
      setUploadError(null);
      const totalBytes = validFiles.reduce((acc: number, f: File) => acc + f.size, 0);
      setUploadProgress({
        percentage: 0,
        speedFormatted: 'Starting upload...',
        loadedFormatted: '0 MB',
        totalFormatted: `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`,
        currentFileIndex: 1,
        totalFiles: validFiles.length,
        currentFileName: validFiles[0]?.name || 'video',
        status: 'uploading',
      });

      await onUploadVideos(validFiles, (info: any) => {
        setUploadProgress({
          percentage: info.percentage,
          speedFormatted: info.speedFormatted,
          loadedFormatted: info.loadedFormatted,
          totalFormatted: info.totalFormatted,
          currentFileIndex: info.currentFileIndex,
          totalFiles: info.totalFiles,
          currentFileName: info.currentFileName,
          status: info.percentage >= 100 ? 'saving' : 'uploading',
        });
      });

      setUploadProgress((prev: any) =>
        prev
          ? {
              ...prev,
              percentage: 100,
              status: 'done',
              speedFormatted: 'Upload complete',
            }
          : null
      );
      setTimeout(() => setUploadProgress(null), 1200);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload video files.');
      setUploadProgress(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndUpload(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndUpload(e.target.files);
      e.target.value = '';
    }
  };

  // Open Replace Modal
  const handleOpenReplaceModal = (vid: VideoRecord) => {
    setVideoToReplace(vid);
    setReplacementFile(null);
    setReplaceModalError(null);
  };

  // Replacement file selected
  const handleSelectReplacementFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const allowedExtensions = ['mp4', 'mov', 'webm', 'avi', 'mkv'];
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (!ext || !allowedExtensions.includes(ext)) {
      setReplaceModalError(`File "${file.name}" is not a supported video format (MP4, MOV, WEBM).`);
      return;
    }
    if (file.size > 300 * 1024 * 1024) {
      setReplaceModalError(`File "${file.name}" exceeds the 300MB maximum size limit.`);
      return;
    }

    setReplaceModalError(null);
    setReplacementFile(file);
    e.target.value = '';
  };

  const confirmReplaceVideo = async () => {
    if (!videoToReplace || !replacementFile) return;
    try {
      setActionLoading(true);
      setReplaceModalError(null);
      if (onReplaceVideo) {
        await onReplaceVideo(videoToReplace.id, replacementFile);
      }
      setVideoToReplace(null);
      setReplacementFile(null);
    } catch (err: any) {
      setReplaceModalError(err?.message || 'Failed to replace video asset.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete video
  const confirmDelete = async () => {
    if (!videoToDelete) return;
    try {
      setActionLoading(true);
      setDeleteModalError(null);
      await onDeleteVideo(videoToDelete.id);
      setVideoToDelete(null);
    } catch (err: any) {
      setDeleteModalError(err?.message || 'Failed to delete video from server.');
    } finally {
      setActionLoading(false);
    }
  };

  // Edit metadata
  const handleStartEdit = (video: VideoRecord) => {
    setVideoToEdit(video);
    setEditNameInput(video.originalName);
  };

  const confirmEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoToEdit || !editNameInput.trim()) return;
    try {
      setActionLoading(true);
      if (onUpdateVideo) {
        await onUpdateVideo(videoToEdit.id, editNameInput.trim());
      }
      setVideoToEdit(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to update video metadata');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered & Sorted Videos
  const filteredVideos = useMemo(() => {
    return videos
      .filter((vid: VideoRecord) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName = vid.originalName.toLowerCase().includes(q);
          if (!matchesName) return false;
        }
        if (formatFilter !== 'all') {
          const ext = vid.filename.split('.').pop()?.toLowerCase();
          if (ext !== formatFilter) return false;
        }
        return true;
      })
      .sort((a: VideoRecord, b: VideoRecord) => {
        if (sortBy === 'newest') {
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
        }
        if (sortBy === 'size_desc') {
          return b.fileSize - a.fileSize;
        }
        if (sortBy === 'size_asc') {
          return a.fileSize - b.fileSize;
        }
        if (sortBy === 'alpha') {
          return a.originalName.localeCompare(b.originalName);
        }
        return 0;
      });
  }, [videos, searchQuery, formatFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DDD7CD]">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              Video Library
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F4F1EB] text-[#1F6D52] font-mono font-semibold border border-[#DDD7CD]">
              {videos.length} {videos.length === 1 ? 'video' : 'videos'} stored
            </span>
          </div>
          <p className="text-sm text-[#0F172A]/70 mt-1">
            Existing videos, thumbnails, file metadata, and video management for social publishing.
          </p>
        </div>

        {/* RULE: When library contains videos, show the single designated upload entry point in header.
            When empty, this button is hidden. */}
        {!isEmpty && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#1F6D52] hover:bg-[#185741] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition self-start sm:self-auto cursor-pointer"
            title="Upload new video asset to library"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Videos</span>
          </button>
        )}

        {/* Hidden File Input for header button & dropzone */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* High-Speed Upload Progress Dashboard */}
      {uploadProgress !== null && (
        <div className="bg-[#F4F1EB] border border-[#1F6D52]/40 rounded-2xl p-4 sm:p-5 shadow-xs animate-in fade-in duration-150 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#0F172A]">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-[#1F6D52]/10 text-[#1F6D52] flex items-center justify-center shrink-0">
                {uploadProgress.status === 'done' ? (
                  <Check className="w-5 h-5 text-[#1F6D52]" />
                ) : (
                  <UploadCloud className="w-5 h-5 text-[#1F6D52] animate-bounce" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-[#0F172A] truncate flex items-center gap-2">
                  <span>
                    {uploadProgress.totalFiles > 1
                      ? `Uploading ${uploadProgress.totalFiles} Videos in Bulk`
                      : `Uploading: ${uploadProgress.currentFileName}`}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#1F6D52]/10 text-[#1F6D52] font-semibold border border-[#1F6D52]/20 font-mono">
                    High-Speed Stream
                  </span>
                </div>
                <p className="text-xs text-[#0F172A]/70 font-mono mt-0.5">
                  {uploadProgress.status === 'saving'
                    ? 'Persisting files to server storage...'
                    : uploadProgress.status === 'done'
                    ? 'Upload complete! Updating video library...'
                    : `${uploadProgress.loadedFormatted} of ${uploadProgress.totalFormatted} • Speed: ${uploadProgress.speedFormatted}`}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <span className="font-mono font-bold text-lg text-[#1F6D52]">
                {uploadProgress.percentage}%
              </span>
            </div>
          </div>

          {/* Real progress track */}
          <div className="w-full h-2.5 bg-[#DDD7CD] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1F6D52] transition-all duration-150 rounded-full"
              style={{ width: `${uploadProgress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800 font-medium animate-in fade-in duration-150">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
            <span>{uploadError}</span>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-rose-700 hover:text-rose-900 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Upload Entry Point & Content States */}
      {isEmpty ? (
        /* =========================================================================
           EMPTY STATE: Exactly ONE central upload component with Browse Files button.
           No header upload button, and NO second redundant panel below.
           ========================================================================= */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-10 sm:p-14 text-center transition-all ${
            isDragging
              ? 'border-[#1F6D52] bg-emerald-50/50'
              : 'border-[#DDD7CD] bg-[#F4F1EB]'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-[#F8F6F1] border border-[#DDD7CD] flex items-center justify-center mx-auto text-[#1F6D52] mb-4 shadow-2xs">
            <FolderOpen className="w-7 h-7" />
          </div>

          <h2 className="text-base font-bold text-[#0F172A]">
            Your Video Library is Empty
          </h2>

          <p className="text-xs sm:text-sm text-[#0F172A]/70 max-w-md mx-auto mt-1.5 mb-5 leading-relaxed">
            Drag and drop your video files here or use the browse button below to store assets for
            TikTok, Instagram Reels, and Facebook Page publishing.
          </p>

          {/* The ONE visible Browse Files button in empty state */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#1F6D52] hover:bg-[#185741] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Browse Files</span>
          </button>

          {/* Supported specs & quality note */}
          <div className="mt-8 pt-6 border-t border-[#DDD7CD]/70 max-w-lg mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-[#0F172A]/60 font-mono">
            <span>Formats: MP4, MOV, WebM</span>
            <span className="hidden sm:inline text-[#DDD7CD]">•</span>
            <span>Max Size: 300MB per file</span>
            <span className="hidden sm:inline text-[#DDD7CD]">•</span>
            <span>Original Quality Preserved</span>
          </div>
        </div>
      ) : (
        /* =========================================================================
           POPULATED STATE: Stored videos library content area with search & controls.
           The large dropzone is HIDDEN. Only the header button was rendered above.
           ========================================================================= */
        <div className="space-y-5">
          {/* Search, Filter, and Sort Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl shadow-2xs">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#0F172A]/60" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search videos by title or filename..."
                className="w-full bg-[#F8F6F1] border border-[#DDD7CD] rounded-xl pl-9 pr-8 py-2 text-xs text-[#0F172A] placeholder-[#0F172A]/40 focus:outline-none focus:border-[#1F6D52]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-[#0F172A]/60 hover:text-[#0F172A] p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter by format & Sort by */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Format Filter */}
              <div className="flex items-center space-x-1 bg-[#F8F6F1] p-1 rounded-xl border border-[#DDD7CD] text-xs">
                {(['all', 'mp4', 'mov', 'webm'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setFormatFilter(fmt)}
                    className={`px-2.5 py-1 rounded-lg uppercase text-xs font-semibold transition cursor-pointer ${
                      formatFilter === fmt
                        ? 'bg-[#1F6D52] text-white shadow-2xs'
                        : 'text-[#0F172A]/70 hover:text-[#0F172A]'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-[#F8F6F1] border border-[#DDD7CD] rounded-xl px-3 py-2 text-xs text-[#0F172A] font-medium focus:outline-none focus:border-[#1F6D52] shadow-2xs cursor-pointer"
              >
                <option value="newest">Newest Uploads</option>
                <option value="oldest">Oldest Uploads</option>
                <option value="size_desc">File Size (Largest)</option>
                <option value="size_asc">File Size (Smallest)</option>
                <option value="alpha">Alphabetical (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Videos Grid */}
          {filteredVideos.length === 0 ? (
            <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-10 text-center shadow-xs">
              <Search className="w-6 h-6 mx-auto mb-2 text-[#0F172A]/60" />
              <h3 className="text-sm font-bold text-[#0F172A]">No Matching Videos</h3>
              <p className="text-xs text-[#0F172A]/70 max-w-sm mx-auto mt-1 mb-3">
                No stored videos match your current search query or format filter.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFormatFilter('all');
                }}
                className="text-xs font-semibold text-[#1F6D52] hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredVideos.map((vid: VideoRecord) => {
                const sizeMb = (vid.fileSize / (1024 * 1024)).toFixed(1);
                const dateStr = new Date(vid.uploadedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const ext = vid.filename.split('.').pop()?.toUpperCase() || 'VIDEO';

                return (
                  <div
                    key={vid.id}
                    className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl overflow-hidden hover:border-[#BD7131]/40 transition-all flex flex-col group shadow-2xs"
                  >
                    {/* Video Thumbnail Preview Player Frame */}
                    <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden border-b border-[#DDD7CD]">
                      {vid.thumbnailUrl ? (
                        <img
                          src={vid.thumbnailUrl}
                          alt={vid.originalName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <video
                          src={vid.fileUrl}
                          className="w-full h-full object-contain pointer-events-none"
                          preload="none"
                        />
                      )}

                      {/* Interactive Hover Preview Play Trigger */}
                      <div
                        onClick={() => setSelectedPreviewVideo(vid)}
                        className="absolute inset-0 bg-black/40 hover:bg-black/25 flex items-center justify-center cursor-pointer transition opacity-0 group-hover:opacity-100"
                        title="Click to play video preview"
                      >
                        <div className="w-11 h-11 rounded-full bg-[#F8F6F1] text-[#0F172A] flex items-center justify-center shadow-lg transform group-hover:scale-105 transition">
                          <Play className="w-5 h-5 ml-0.5 text-[#1F6D52]" />
                        </div>
                      </div>

                      {/* Format Badge */}
                      <span className="absolute bottom-2 right-2 text-xs font-mono font-bold bg-black/80 text-white px-2 py-0.5 rounded shadow-2xs">
                        {ext}
                      </span>

                      {/* Processing / Stored Status Badge */}
                      <span className="absolute top-2 left-2 text-xs font-mono font-semibold bg-[#F8F6F1]/95 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded shadow-2xs flex items-center gap-1">
                        <Check className="w-3 h-3 text-[#1F6D52]" />
                        <span>Ready</span>
                      </span>
                    </div>

                    {/* Metadata Content Area */}
                    <div className="p-4 flex-1 flex flex-col justify-between bg-[#F4F1EB] space-y-3">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            className="text-sm font-bold text-[#0F172A] truncate flex-1"
                            title={vid.originalName}
                          >
                            {vid.originalName}
                          </h3>
                          <button
                            onClick={() => handleStartEdit(vid)}
                            className="text-[#0F172A]/60 hover:text-[#1F6D52] p-0.5 rounded transition cursor-pointer"
                            title="Edit Title / Rename"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Metadata Details */}
                        <div className="flex items-center space-x-3 text-xs text-[#0F172A]/60 mt-1.5 font-mono">
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3 text-[#0F172A]/60" />
                            {sizeMb} MB
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#0F172A]/60" />
                            {dateStr}
                          </span>
                        </div>
                      </div>

                      {/* Per-Video Actions Toolbar */}
                      <div className="pt-3 border-t border-[#DDD7CD] flex items-center justify-between gap-1.5">
                        {/* Select for Publishing / Use in Post */}
                        {onSelectVideoForPost && (
                          <button
                            onClick={() => onSelectVideoForPost(vid)}
                            className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-[#1F6D52] hover:bg-[#185741] text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                            title="Select this video to create a social post"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Use in Post</span>
                          </button>
                        )}

                        {/* Preview Action */}
                        <button
                          onClick={() => setSelectedPreviewVideo(vid)}
                          className="p-1.5 text-[#0F172A]/70 hover:text-[#0F172A] hover:bg-[#F8F6F1] rounded-lg transition border border-transparent hover:border-[#DDD7CD] cursor-pointer"
                          title="Preview Video Playback"
                        >
                          <Play className="w-4 h-4" />
                        </button>

                        {/* Replace File Action */}
                        {onReplaceVideo && (
                          <button
                            onClick={() => handleOpenReplaceModal(vid)}
                            className="p-1.5 text-[#0F172A]/70 hover:text-[#0F172A] hover:bg-[#F8F6F1] rounded-lg transition border border-transparent hover:border-[#DDD7CD] cursor-pointer"
                            title="Change / Replace Video Asset"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete Action */}
                        <button
                          onClick={() => setVideoToDelete(vid)}
                          className="p-1.5 text-[#0F172A]/60 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Video from Server"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Video Preview Modal */}
      {selectedPreviewVideo && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#F8F6F1] border border-[#DDD7CD] rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#DDD7CD]">
              <h3 className="text-sm font-bold text-[#0F172A] truncate max-w-md">
                {selectedPreviewVideo.originalName}
              </h3>
              <button
                onClick={() => setSelectedPreviewVideo(null)}
                className="text-[#0F172A]/60 hover:text-[#0F172A] p-1 rounded-lg hover:bg-[#F4F1EB] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex items-center justify-center">
              <video
                src={selectedPreviewVideo.fileUrl}
                controls
                autoPlay
                className="max-h-[60vh] max-w-full rounded-lg"
              />
            </div>

            <div className="p-4 bg-[#F4F1EB] border-t border-[#DDD7CD] flex items-center justify-between text-xs text-[#0F172A]/70">
              <div className="font-mono">
                Size: {(selectedPreviewVideo.fileSize / (1024 * 1024)).toFixed(1)} MB • {selectedPreviewVideo.mimeType}
              </div>
              {onSelectVideoForPost && (
                <button
                  onClick={() => {
                    const v = selectedPreviewVideo;
                    setSelectedPreviewVideo(null);
                    onSelectVideoForPost(v);
                  }}
                  className="px-3.5 py-1.5 bg-[#1F6D52] hover:bg-[#185741] text-white rounded-lg font-semibold transition cursor-pointer"
                >
                  Use in Post
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {videoToEdit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#F8F6F1] border border-[#DDD7CD] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD7CD]">
              <h3 className="text-base font-bold text-[#0F172A]">Edit Video Title</h3>
              <button
                onClick={() => setVideoToEdit(null)}
                className="text-[#0F172A]/60 hover:text-[#0F172A] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={confirmEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Display Filename / Title
                </label>
                <input
                  type="text"
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  className="w-full bg-[#F4F1EB] border border-[#DDD7CD] rounded-xl px-3.5 py-2 text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#1F6D52] shadow-2xs"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#DDD7CD]">
                <button
                  type="button"
                  onClick={() => setVideoToEdit(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0F172A] hover:bg-[#F4F1EB] transition border border-[#DDD7CD] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1F6D52] hover:bg-[#185741] transition shadow-xs cursor-pointer"
                >
                  {actionLoading ? 'Saving...' : 'Save Title'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {videoToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#F8F6F1] border border-[#DDD7CD] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD7CD]">
              <div className="flex items-center space-x-2 text-rose-700">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-bold text-[#0F172A]">Delete Video Asset?</h3>
              </div>
              <button
                onClick={() => {
                  setVideoToDelete(null);
                  setDeleteModalError(null);
                }}
                disabled={actionLoading}
                className="text-[#0F172A]/60 hover:text-[#0F172A] p-1 rounded-lg hover:bg-[#F4F1EB] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#0F172A]/70 leading-relaxed">
              Are you sure you want to delete &ldquo;
              <strong className="text-[#0F172A] font-semibold">{videoToDelete.originalName}</strong>
              &rdquo; from persistent server storage? This will remove the file permanently.
            </p>

            {deleteModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{deleteModalError}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-[#DDD7CD]">
              <button
                onClick={() => {
                  setVideoToDelete(null);
                  setDeleteModalError(null);
                }}
                disabled={actionLoading}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#0F172A] hover:bg-[#F4F1EB] transition border border-[#DDD7CD] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 transition shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change / Replace Video Asset Modal */}
      {videoToReplace && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#F8F6F1] border border-[#DDD7CD] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD7CD]">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-[#1F6D52]/10 text-[#1F6D52] flex items-center justify-center">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Change / Replace Video Asset</h3>
                  <p className="text-xs text-[#0F172A]/60">Replace the source file while keeping post connections intact</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setVideoToReplace(null);
                  setReplacementFile(null);
                  setReplaceModalError(null);
                }}
                disabled={actionLoading}
                className="text-[#0F172A]/60 hover:text-[#0F172A] p-1 rounded-lg hover:bg-[#F4F1EB] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Video Info */}
            <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-xl p-3 text-xs space-y-1">
              <span className="text-[#0F172A]/60 font-semibold block uppercase tracking-wider text-xs">
                Current Video Asset
              </span>
              <p className="font-bold text-[#0F172A] truncate">{videoToReplace.originalName}</p>
              <p className="text-xs text-[#0F172A]/70 font-mono">
                Size: {(videoToReplace.fileSize / (1024 * 1024)).toFixed(1)} MB • Format: {videoToReplace.mimeType}
              </p>
            </div>

            {/* Error Banner */}
            {replaceModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{replaceModalError}</span>
              </div>
            )}

            {/* Replacement Selection Zone */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#0F172A]">
                Select New Replacement Video
              </label>

              {!replacementFile ? (
                <div
                  onClick={() => replaceFileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#DDD7CD] hover:border-[#1F6D52] rounded-xl p-6 text-center cursor-pointer transition bg-[#F4F1EB]/50 hover:bg-[#F4F1EB]"
                >
                  <UploadCloud className="w-8 h-8 text-[#1F6D52] mx-auto mb-2" />
                  <p className="text-xs font-bold text-[#0F172A]">Click to choose replacement video</p>
                  <p className="text-xs text-[#0F172A]/60 mt-0.5">
                    Supports MP4, MOV, WEBM (up to 300MB)
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    <Check className="w-4 h-4 text-[#1F6D52] shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-[#0F172A] truncate">
                        {replacementFile.name}
                      </p>
                      <p className="text-xs text-[#0F172A]/70 font-mono">
                        {(replacementFile.size / (1024 * 1024)).toFixed(1)} MB • Ready to replace
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => replaceFileInputRef.current?.click()}
                    className="text-xs text-[#1F6D52] font-semibold hover:underline shrink-0 ml-2 cursor-pointer"
                  >
                    Change file
                  </button>
                </div>
              )}

              {/* Hidden file input for replace modal */}
              <input
                ref={replaceFileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={handleSelectReplacementFile}
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-[#DDD7CD]">
              <button
                type="button"
                onClick={() => {
                  setVideoToReplace(null);
                  setReplacementFile(null);
                  setReplaceModalError(null);
                }}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0F172A] hover:bg-[#F4F1EB] transition border border-[#DDD7CD] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReplaceVideo}
                disabled={!replacementFile || actionLoading}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition shadow-xs flex items-center space-x-1.5 cursor-pointer ${
                  !replacementFile || actionLoading
                    ? 'bg-[#1F6D52]/40 text-white cursor-not-allowed'
                    : 'bg-[#1F6D52] hover:bg-[#185741] text-white'
                }`}
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Replacing Video...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Upload &amp; Replace Video</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
