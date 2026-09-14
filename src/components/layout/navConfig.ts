import React from 'react';
import {
  LayoutDashboard, Users, UserPlus, Mic, PhoneCall, CheckSquare,
  CreditCard, FileText, BookOpen, Smartphone, Wrench,
  Paperclip, BarChart3, ShieldCheck, History, Settings, Database, Sparkles,
  Scale, Inbox, Handshake, MessageCircle
} from 'lucide-react';
import { User } from '../../types';
import { isAdmin } from '../../lib/permissions';
import { Language } from '../../lib/i18n';

export interface NavItemConfig {
  id: string;
  titleKey: string;
  descKey?: string;
  defaultTitleFa: string;
  defaultTitleEn: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'rose' | 'emerald';
  adminOnly?: boolean;
}

export interface NavSectionConfig {
  id: 'main' | 'customers' | 'operations' | 'inventory' | 'documents' | 'finance' | 'management' | 'system';
  titleKey: string;
  defaultTitleFa: string;
  defaultTitleEn: string;
  items: NavItemConfig[];
}

export interface NavCounts {
  tasksCount?: number;
  checksCount?: number;
  repairsCount?: number;
  voiceNotesCount?: number;
  inboxUnreadCount?: number;
  chatUnreadCount?: number;
}

export function getNavSections(currentUser?: User, counts: NavCounts = {}, language: Language = 'fa'): NavSectionConfig[] {
  const userIsAdmin = isAdmin(currentUser);
  const {
    tasksCount = 0,
    checksCount = 0,
    repairsCount = 0,
    voiceNotesCount = 0,
    inboxUnreadCount = 0,
    chatUnreadCount = 0,
  } = counts;

  return [
    {
      id: 'main',
      titleKey: 'nav.group.main',
      defaultTitleFa: 'اصلی',
      defaultTitleEn: 'Main',
      items: [
        {
          id: 'dashboard',
          titleKey: 'nav.dashboard',
          descKey: 'nav.desc.dashboard',
          defaultTitleFa: 'داشبورد',
          defaultTitleEn: 'Dashboard',
          icon: LayoutDashboard,
        },
        {
          id: 'chat',
          titleKey: 'nav.chat',
          descKey: 'nav.desc.chat',
          defaultTitleFa: 'گفتگوها',
          defaultTitleEn: 'Chat',
          icon: MessageCircle,
          badge: chatUnreadCount > 0 ? String(chatUnreadCount) : undefined,
          badgeVariant: 'danger',
        },
      ],
    },
    {
      id: 'customers',
      titleKey: 'nav.group.customers',
      defaultTitleFa: 'مشتریان',
      defaultTitleEn: 'Customers',
      items: [
        {
          id: 'customers',
          titleKey: 'nav.customers',
          descKey: 'nav.desc.customers',
          defaultTitleFa: 'مشتریان',
          defaultTitleEn: 'Customers',
          icon: Users,
        },
        {
          id: 'leads',
          titleKey: 'nav.leads',
          descKey: 'nav.desc.leads',
          defaultTitleFa: 'سرنخ‌ها و تماس ناشناس',
          defaultTitleEn: 'Leads & Prospects',
          icon: UserPlus,
        },
        {
          id: 'voicenotes',
          titleKey: 'nav.voicenotes',
          descKey: 'nav.desc.voicenotes',
          defaultTitleFa: 'یادداشت‌ها',
          defaultTitleEn: 'Notes',
          icon: Mic,
          badge: voiceNotesCount > 0 ? (language === 'fa' ? String(voiceNotesCount) : String(voiceNotesCount)) : undefined,
          badgeVariant: 'rose',
        },
      ],
    },
    {
      id: 'operations',
      titleKey: 'nav.group.operations',
      defaultTitleFa: 'عملیات',
      defaultTitleEn: 'Operations',
      items: [
        {
          id: 'calls',
          titleKey: 'nav.calls',
          descKey: 'nav.desc.calls',
          defaultTitleFa: 'تماس‌ها',
          defaultTitleEn: 'Calls',
          icon: PhoneCall,
        },
        {
          id: 'tasks',
          titleKey: 'nav.tasks',
          descKey: 'nav.desc.tasks',
          defaultTitleFa: 'وظایف',
          defaultTitleEn: 'Tasks',
          icon: CheckSquare,
          badge: tasksCount > 0 ? (language === 'fa' ? String(tasksCount) : String(tasksCount)) : undefined,
          badgeVariant: 'emerald',
        },
      ],
    },
    {
      id: 'inventory',
      titleKey: 'nav.group.inventory',
      defaultTitleFa: 'انبار و تجهیزات',
      defaultTitleEn: 'Inventory',
      items: [
        {
          id: 'sims',
          titleKey: 'nav.sims',
          descKey: 'nav.desc.sims',
          defaultTitleFa: 'سیم‌کارت‌ها',
          defaultTitleEn: 'SIM Cards',
          icon: Smartphone,
        },
        {
          id: 'consignment',
          titleKey: 'nav.consignment',
          descKey: 'nav.desc.consignment',
          defaultTitleFa: 'سیم‌کارت امانی',
          defaultTitleEn: 'Consignment',
          icon: Handshake,
        },
        {
          id: 'repairs',
          titleKey: 'nav.repairs',
          descKey: 'nav.desc.repairs',
          defaultTitleFa: 'تعمیرات',
          defaultTitleEn: 'Repairs',
          icon: Wrench,
          badge: repairsCount > 0 ? (language === 'fa' ? String(repairsCount) : String(repairsCount)) : undefined,
          badgeVariant: 'info',
        },
      ],
    },
    {
      id: 'documents',
      titleKey: 'nav.group.documents',
      defaultTitleFa: 'اسناد',
      defaultTitleEn: 'Documents',
      items: [
        {
          id: 'attachments',
          titleKey: 'nav.attachments',
          descKey: 'nav.desc.attachments',
          defaultTitleFa: 'اسناد',
          defaultTitleEn: 'Documents',
          icon: Paperclip,
        },
        {
          id: 'inbox',
          titleKey: 'nav.inbox',
          descKey: 'nav.desc.inbox',
          defaultTitleFa: 'صندوق ورودی اسناد',
          defaultTitleEn: 'Documents Inbox',
          icon: Inbox,
          badge: inboxUnreadCount > 0 ? String(inboxUnreadCount) : undefined,
          badgeVariant: 'danger',
        },
      ],
    },
    {
      id: 'finance',
      titleKey: 'nav.group.finance',
      defaultTitleFa: 'مالی',
      defaultTitleEn: 'Finance',
      items: [
        {
          id: 'finances',
          titleKey: 'nav.finances',
          descKey: 'nav.desc.finances',
          defaultTitleFa: 'دریافت‌ها',
          defaultTitleEn: 'Payments',
          icon: CreditCard,
        },
        {
          id: 'checks',
          titleKey: 'nav.checks',
          descKey: 'nav.desc.checks',
          defaultTitleFa: 'چک‌ها',
          defaultTitleEn: 'Checks',
          icon: FileText,
          badge: checksCount > 0 ? (language === 'fa' ? String(checksCount) : String(checksCount)) : undefined,
          badgeVariant: 'warning',
        },
        {
          id: 'contracts',
          titleKey: 'nav.contracts',
          descKey: 'nav.desc.contracts',
          defaultTitleFa: 'قراردادها',
          defaultTitleEn: 'Contracts',
          icon: BookOpen,
        },
        {
          id: 'accounting',
          titleKey: 'nav.accounting',
          descKey: 'nav.desc.accounting',
          defaultTitleFa: 'حسابداری و دفتر کل',
          defaultTitleEn: 'Accounting & Ledger',
          icon: Scale,
        },
      ],
    },
    {
      id: 'management',
      titleKey: 'nav.group.management',
      defaultTitleFa: 'مدیریت',
      defaultTitleEn: 'Management',
      items: [
        {
          id: 'reports',
          titleKey: 'nav.reports',
          descKey: 'nav.desc.reports',
          defaultTitleFa: 'گزارش‌ها',
          defaultTitleEn: 'Reports',
          icon: BarChart3,
        },
        ...(userIsAdmin
          ? [
              {
                id: 'users',
                titleKey: 'nav.users',
                descKey: 'nav.desc.users',
                defaultTitleFa: 'کاربران',
                defaultTitleEn: 'Users',
                icon: ShieldCheck,
                adminOnly: true,
              },
              {
                id: 'audit',
                titleKey: 'nav.audit',
                descKey: 'nav.desc.audit',
                defaultTitleFa: 'گزارش فعالیت',
                defaultTitleEn: 'Activity Log',
                icon: History,
                adminOnly: true,
              },
            ]
          : []),
      ],
    },
    ...(userIsAdmin
      ? [
          {
            id: 'system' as const,
            titleKey: 'nav.group.system',
            defaultTitleFa: 'سیستم',
            defaultTitleEn: 'System',
            items: [
              {
                id: 'settings',
                titleKey: 'nav.settings',
                descKey: 'nav.desc.settings',
                defaultTitleFa: 'تنظیمات',
                defaultTitleEn: 'Settings',
                icon: Settings,
                adminOnly: true,
              },
              {
                id: 'backups',
                titleKey: 'nav.backups',
                descKey: 'nav.desc.backups',
                defaultTitleFa: 'پشتیبان‌گیری',
                defaultTitleEn: 'Backups',
                icon: Database,
                adminOnly: true,
              },
            ],
          },
        ]
      : []),
  ];
}
