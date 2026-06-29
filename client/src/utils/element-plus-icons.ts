/**
 * Element Plus 图标注册 (按需注册)
 * 只注册项目中实际使用的图标, 避免全量导入增加入口 chunk 体积
 */

import type { App, Component } from 'vue'
import {
  Aim, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Avatar, Bell, Box, Brush,
  Calendar, Cellphone, ChatDotRound, ChatLineRound, ChatLineSquare, Check,
  CircleCheck, CircleCheckFilled, CircleClose, CircleCloseFilled, Clock, Close,
  Cloudy, Coin, Collection, Compass, Connection, CopyDocument, Cpu, CreditCard,
  DataAnalysis, DataLine, DArrowLeft, DArrowRight, Delete, Document, DocumentAdd,
  DocumentChecked, DocumentCopy, Download, Edit, EditPen, Files, Film, Filter,
  FirstAidKit, Fold, Folder, FolderOpened, FullScreen, Grid, Headset, Hide,
  Histogram, HomeFilled, House, InfoFilled, Iphone, Key, Lightning, Link, List,
  Loading, Location, Lock, MagicStick, Management, MapLocation, Medal, Menu,
  Message, Mic, Microphone, Minus, Money, Monitor, Moon, More, MoreFilled,
  OfficeBuilding, Odometer, Operation, Paperclip, Phone, Picture, PictureFilled,
  Platform, Plus, Position, Present, Printer, Promotion, QuestionFilled, Rank,
  Reading, Refresh, RefreshRight, RemoveFilled, Search, Select, Service, Setting,
  Share, ShoppingBag, ShoppingCart, Sort, Star, StarFilled, SuccessFilled, Sunny,
  Switch, SwitchButton, Timer, Tools, Trophy, TrendCharts, Upload, UploadFilled,
  User, UserFilled, VideoCamera, VideoPause, VideoPlay, View, Wallet, Warning,
  WarningFilled, ZoomIn,
} from '@element-plus/icons-vue'
import { logger } from './logger'

// 项目中实际使用的图标映射表
const usedIcons = {
  Aim, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Avatar, Bell, Box, Brush,
  Calendar, Cellphone, ChatDotRound, ChatLineRound, ChatLineSquare, Check,
  CircleCheck, CircleCheckFilled, CircleClose, CircleCloseFilled, Clock, Close,
  Cloudy, Coin, Collection, Compass, Connection, CopyDocument, Cpu, CreditCard,
  DataAnalysis, DataLine, DArrowLeft, DArrowRight, Delete, Document, DocumentAdd,
  DocumentChecked, DocumentCopy, Download, Edit, EditPen, Files, Film, Filter,
  FirstAidKit, Fold, Folder, FolderOpened, FullScreen, Grid, Headset, Hide,
  Histogram, HomeFilled, House, InfoFilled, Iphone, Key, Lightning, Link, List,
  Loading, Location, Lock, MagicStick, Management, MapLocation, Medal, Menu,
  Message, Mic, Microphone, Minus, Money, Monitor, Moon, More, MoreFilled,
  OfficeBuilding, Odometer, Operation, Paperclip, Phone, Picture, PictureFilled,
  Platform, Plus, Position, Present, Printer, Promotion, QuestionFilled, Rank,
  Reading, Refresh, RefreshRight, RemoveFilled, Search, Select, Service, Setting,
  Share, ShoppingBag, ShoppingCart, Sort, Star, StarFilled, SuccessFilled, Sunny,
  Switch, SwitchButton, Timer, Tools, Trophy, TrendCharts, Upload, UploadFilled,
  User, UserFilled, VideoCamera, VideoPause, VideoPlay, View, Wallet, Warning,
  WarningFilled, ZoomIn,
}

/**
 * 注册项目中使用的 Element Plus 图标 (按需注册, 非全量)
 */
export function registerIcons(app: App): void {
  for (const [name, component] of Object.entries(usedIcons)) {
    app.component(name, component as Component)
  }

  logger.info(`[Icons] Element Plus icons registered (${Object.keys(usedIcons).length} icons)`)
}

/**
 * 获取图标组件
 * @param name 图标名称
 */
export function getIcon(name: string) {
  return (usedIcons as Record<string, unknown>)[name]
}

/**
 * 检查图标是否存在
 * @param name 图标名称
 */
export function hasIcon(name: string): boolean {
  return name in usedIcons
}

export default registerIcons
