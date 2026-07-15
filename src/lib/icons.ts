import {
  LayoutDashboard, CheckSquare, Calendar, Users, StickyNote,
  FolderOpen, Lock, Briefcase, Folder, File, Settings, Search,
  Bell, BarChart3, Bot, Zap, Tag, Star, Clock, Filter,
  Inbox, ListTodo, KanbanSquare, Mail, Phone, MessageSquare,
  Globe, BookOpen, Database, Cloud, Download, Upload, Plus,
  MoreHorizontal, ChevronLeft, ChevronRight, ChevronDown,
  Archive, Trash2, Edit3, Copy, Move, Eye, EyeOff, X, Check,
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ExternalLink,
  RefreshCw, Power, LogOut, User, UserPlus, Key, Shield,
  Palette, Moon, Sun, Maximize2, Minimize2, Menu, Grid,
  Layers, GitBranch, Link2, Paperclip, Bookmark, Flag,
  Circle, CircleDot, CircleDashed, AlarmClock,
  CalendarDays, CalendarRange, Notebook, Files, KeyRound,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, CheckSquare, Calendar, Users, StickyNote,
  FolderOpen, Lock, Briefcase, Folder, File, Settings, Search,
  Bell, BarChart3, Bot, Zap, Tag, Star, Clock, Filter,
  Inbox, ListTodo, KanbanSquare, Mail, Phone, MessageSquare,
  Globe, BookOpen, Database, Cloud, Download, Upload, Plus,
  MoreHorizontal, ChevronLeft, ChevronRight, ChevronDown,
  Archive, Trash2, Edit3, Copy, Move, Eye, EyeOff, X, Check,
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ExternalLink,
  RefreshCw, Power, LogOut, User, UserPlus, Key, Shield,
  Palette, Moon, Sun, Maximize2, Minimize2, Menu, Grid,
  Layers, GitBranch, Link2, Paperclip, Bookmark, Flag,
  Circle, CircleDot, CircleDashed, AlarmClock,
  CalendarDays, CalendarRange, Notebook, Files, KeyRound,
};

export function resolveIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Circle;
  return iconMap[name] ?? Circle;
}
