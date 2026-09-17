import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Story, Chapter } from '../types';
import { getStoryChapters } from '../data/mockData';
import { subscribeToStoryChapters, recordStoryView } from '../lib/realtimeService';
import { StoryDetailView } from './StoryDetailView';
import { ReaderView } from './ReaderView';
import { ArrowLeft, BookOpen, AlertCircle, Home } from 'lucide-react';

interface StoryDetailPageProps {
  stories: Story[];
}

export const StoryDetailPage: React.FC<StoryDetailPageProps> = ({ stories }) => {
  const { id, chapterNumber } = useParams<{ id: string; chapterNumber?: string }>();
  const navigate = useNavigate();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [id, chapterNumber]);

  // Find matching story by ID or known aliases
  const story = stories.find(
    (s) =>
      s.id === id ||
      (id === 'anh-dao-5cm' && s.id === 'anh-dao-nam-centimet') ||
      (id === 'anh-dao-nam-centimet' && s.id === 'anh-dao-5cm')
  );

  // Record view once when story is loaded
  useEffect(() => {
    if (story) {
      recordStoryView(story.id);
    }
  }, [story?.id]);

  // Realtime chapters state with fallback from mockData
  const [chapters, setChapters] = useState<Chapter[]>(() => {
    if (!story) return [];
    return getStoryChapters(story.id);
  });

  useEffect(() => {
    if (!story) return;
    // Initial mock chapters
    const initial = getStoryChapters(story.id);
    setChapters(initial);

    // Subscribe to live chapters from Firestore if available
    const unsubscribe = subscribeToStoryChapters(story.id, (liveChapters) => {
      if (liveChapters && liveChapters.length > 0) {
        setChapters(liveChapters);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [story?.id]);

  // 1. Story Not Found state
  if (!story) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-pink-100 dark:bg-stone-800 text-pink-600 dark:text-pink-400 flex items-center justify-center shadow-xs">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-800 dark:text-stone-100">
            Không tìm thấy bài viết hoặc truyện
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 font-sans">
            Đường link bạn mở có thể chưa đúng hoặc tác phẩm đã được điều chỉnh mã định danh (slug).
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium transition-colors shadow-xs"
          >
            <Home className="w-4 h-4" />
            <span>Về trang chủ</span>
          </Link>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-sm font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Reading a specific chapter route: /bai-viet/:id/chuong/:chapterNumber
  if (chapterNumber !== undefined) {
    const targetChapterNum = Number(chapterNumber);
    const chapter = chapters.find((c) => c.chapterNumber === targetChapterNum) || chapters[0];

    if (!chapter) {
      return (
        <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
          <p className="text-stone-600 dark:text-stone-300 font-serif">
            Chưa tìm thấy chương {chapterNumber} của truyện <strong>{story.title}</strong>.
          </p>
          <Link
            to={`/bai-viet/${story.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-500 text-white text-sm font-medium"
          >
            <BookOpen className="w-4 h-4" />
            <span>Về mục lục truyện</span>
          </Link>
        </div>
      );
    }

    return (
      <ReaderView
        story={story}
        chapter={chapter}
        allChapters={chapters}
        onBack={() => navigate(`/bai-viet/${story.id}`)}
        onSelectChapter={(num) => navigate(`/bai-viet/${story.id}/chuong/${num}`)}
        onGoToPasswordGuide={() => navigate('/pass')}
        onOpenStoryDetail={() => navigate(`/bai-viet/${story.id}`)}
      />
    );
  }

  // 3. Story Detail View: /bai-viet/:id
  return (
    <StoryDetailView
      story={story}
      chapters={chapters}
      onBack={() => {
        if (window.history.length > 2) {
          navigate(-1);
        } else {
          navigate('/');
        }
      }}
      onSelectChapter={(num) => navigate(`/bai-viet/${story.id}/chuong/${num}`)}
      onGoToPasswordGuide={() => navigate('/pass')}
    />
  );
};
