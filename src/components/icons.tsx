import {
  AppWindow, BatteryCharging, Boxes, BrickWall, Building2, Cloud, EthernetPort, FileBadge, FileText, Folder, Globe,
  HardDrive, KeyRound, Timer, Laptop, Lock, MapPin, Monitor, Network, Printer, Router, Server, ServerCog, Shield, Wifi, Box,
  type LucideIcon,
} from "lucide-react";

const FOLDER: Record<string, LucideIcon> = {
  folder: Folder, site: MapPin, servers: Server, virtual: Boxes, network: Network, firewall: BrickWall,
  switches: EthernetPort, wireless: Wifi, storage: HardDrive, workstations: Monitor, printers: Printer,
  ups: BatteryCharging, vpn: Lock, cloud: Cloud, passwords: KeyRound, documents: FileText,
};

// Entry icons: systems use their type, the other kinds have one icon each.
const ENTRY: Record<string, LucideIcon> = {
  server: Server, workstation: Monitor, laptop: Laptop, vm: ServerCog, firewall: Shield, switch: EthernetPort,
  router: Router, access_point: Wifi, storage: HardDrive, printer: Printer, ups: BatteryCharging, cloud: Cloud,
  application: AppWindow, website: Globe, other: Box,
  credential: KeyRound, certificate: FileBadge, document: FileText, otp: Timer,
};

export function FolderIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const Icon = FOLDER[icon] ?? Folder;
  return <Icon size={size} className={`ico ico-folder ico-folder-${icon}`} aria-hidden />;
}

export function EntryIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const Icon = ENTRY[icon] ?? Box;
  const tone = icon === "otp" ? "otp" : icon === "credential" ? "key" : icon === "certificate" ? "cert" : icon === "document" ? "doc" : "system";
  return <Icon size={size} className={`ico ico-${tone}`} aria-hidden />;
}

export function OrgIcon({ kind, size = 16 }: { kind: string; size?: number }) {
  return <Building2 size={size} className={`ico ${kind === "internal" ? "ico-internal" : "ico-org"}`} aria-hidden />;
}

export const entryIconKey = (kind: string, row: Record<string, unknown>) =>
  kind === "assets" ? String(row.type ?? "other") : kind === "credentials" ? "credential" : kind === "certificates" ? "certificate" : kind === "otp" ? "otp" : "document";
