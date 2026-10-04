"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MapPin, User, Wrench, Search, Box, Building2, Warehouse, HardDrive, UserCheck } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/custom/page-header";

export default function EquipmentPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [assignModal, setAssignModal] = useState<{ open: boolean; asset: any | null }>({ open: false, asset: null });

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setCurrentUser(JSON.parse(stored));
  }, []);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/equipment`);
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
  });

  // Fetch technicians list
  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/users`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: currentUser?.role === "admin" || currentUser?.role === "manager",
  });
  const technicians = Array.isArray(allUsers) ? allUsers.filter((u: any) => u.role === "technician") : [];

  const createAsset = useMutation({
    mutationFn: async (newAsset: any) => {
      const res = await fetch(`${API_BASE}/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAsset),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setIsModalOpen(false);
      toast.success("Asset registered successfully");
    },
    onError: () => toast.error("Failed to register asset"),
  });

  const assignTechnician = useMutation({
    mutationFn: async ({ assetId, technicianId }: { assetId: string; technicianId: string }) => {
      const res = await fetch(`${API_BASE}/equipment/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTechnicianId: technicianId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setAssignModal({ open: false, asset: null });
      toast.success("Technician assigned successfully");
    },
    onError: () => toast.error("Failed to assign technician"),
  });

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createAsset.mutate(Object.fromEntries(formData.entries()));
  };

  const handleAssign = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const technicianId = fd.get("technicianId") as string;
    if (!technicianId) return toast.error("Please select a technician");
    assignTechnician.mutate({ assetId: assignModal.asset.id, technicianId });
  };

  const canManage = currentUser?.role === "admin" || currentUser?.role === "manager";

  const safeAssets = Array.isArray(assets) ? assets : [];
  const filteredAssets = safeAssets.filter((item: any) =>
    item?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item?.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) return <div className="p-10 text-center font-medium">Syncing Inventory...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Inventory"
        subtitle="Manage equipment registry, maintenance records, and asset status"
        icon={<HardDrive size={20} />}
        accentColor="#06b6d4"
        actions={
          <div className="flex items-center gap-3">
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#475569' }} />
              <Input
                placeholder="Search name or serial..."
                className="pl-9 h-9 rounded-xl text-sm"
                style={{ background: 'rgba(30,40,64,0.6)', border: '1px solid rgba(148,163,184,0.12)', color: '#e8eaf2' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {canManage && (
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-glow gap-2 h-9 px-4 text-sm font-bold rounded-xl">
                    <Plus size={16} /> Add Asset
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className="sm:max-w-[550px] rounded-2xl"
                  style={{ background: 'rgba(13,21,37,0.98)', border: '1px solid rgba(148,163,184,0.12)', backdropFilter: 'blur(20px)' }}
                >
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2" style={{ color: '#e8eaf2' }}>
                      <HardDrive size={17} style={{ color: '#06b6d4' }} /> Register New Asset
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleFormSubmit} className="grid grid-cols-2 gap-4 pt-3">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Asset Name</label>
                      <Input name="name" placeholder='e.g. CNC Lathe Machine' className="h-11 rounded-xl text-sm" style={darkInput} required />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Serial Number</label>
                      <Input name="serialNumber" placeholder="SN-9921" className="h-11 rounded-xl text-sm" style={darkInput} required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Category</label>
                      <Input name="category" placeholder="Machinery" className="h-11 rounded-xl text-sm" style={darkInput} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Department</label>
                      <Input name="department" placeholder="Production" className="h-11 rounded-xl text-sm" style={darkInput} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Location</label>
                      <Input name="location" placeholder="Floor 1, Bay A" className="h-11 rounded-xl text-sm" style={darkInput} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Work Center</label>
                      <Input name="workCenter" placeholder="Assembly Line A" className="h-11 rounded-xl text-sm" style={darkInput} />
                    </div>
                    <Button type="submit" className="col-span-2 h-11 btn-glow font-bold rounded-xl" disabled={createAsset.isPending}>
                      {createAsset.isPending ? "Registering..." : "Register Asset"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />

      {/* Asset Cards Grid */}
      {filteredAssets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <HardDrive size={48} style={{ color: '#1e2840' }} />
          <p className="text-sm font-semibold" style={{ color: '#475569' }}>No assets found</p>
          <p className="text-xs" style={{ color: '#334155' }}>Add your first asset to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredAssets.map((item: any) => (
            <div
              key={item.id}
              className="rounded-2xl p-5 space-y-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg text-left"
              style={{
                background: 'rgba(19,25,41,0.9)',
                border: '1px solid rgba(148,163,184,0.08)',
                borderLeft: `3px solid ${item.isUsable ? '#10b981' : '#f43f5e'}`,
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <p className="text-base font-extrabold tracking-tight truncate" style={{ color: '#e8eaf2' }}>{item.name}</p>
                  <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#334155' }}>{item.serialNumber}</p>
                </div>
                <span
                  className="text-[9px] font-extrabold uppercase px-2 py-1 rounded-lg shrink-0"
                  style={item.isUsable
                    ? { background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }
                    : { background: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.2)' }
                  }
                >
                  {item.isUsable ? "Operational" : "Scrapped"}
                </span>
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: <Box size={10} />, label: 'Category', value: item.category || 'General' },
                  { icon: <Building2 size={10} />, label: 'Dept.', value: item.department || 'Unassigned' },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="p-2 rounded-lg" style={{ background: 'rgba(30,40,64,0.6)', border: '1px solid rgba(148,163,184,0.06)' }}>
                    <p className="text-[9px] font-bold uppercase mb-0.5 flex items-center gap-1" style={{ color: '#475569' }}>{icon} {label}</p>
                    <p className="text-xs font-semibold truncate" style={{ color: '#94a3b8' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-xs" style={{ color: '#64748b' }}>
                <div className="flex items-center gap-2"><MapPin size={12} style={{ color: '#6366f1' }} /><span className="truncate">{item.location || 'No Location'}</span></div>
                <div className="flex items-center gap-2"><Warehouse size={12} style={{ color: '#f59e0b' }} /><span className="truncate">{item.workCenter || 'No Work Center'}</span></div>
                <div className="flex items-center gap-2"><User size={12} style={{ color: '#94a3b8' }} /><span className="truncate">{item.assignedEmployee || 'Unassigned'}</span></div>
              </div>

              {/* Footer */}
              <div className="pt-1 space-y-2" style={{ borderTop: '1px solid rgba(148,163,184,0.06)' }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5" style={{ color: '#475569' }}>
                    <Wrench size={13} style={{ color: '#f59e0b' }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Maintenance Records</span>
                  </div>
                  <span
                    className="text-xs font-extrabold px-2.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}
                  >
                    {item.requestCount || 0}
                  </span>
                </div>

                {/* Assign Technician — admin & manager only */}
                {canManage && (
                  <button
                    onClick={() => setAssignModal({ open: true, asset: item })}
                    className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all hover:opacity-90"
                    style={{
                      background: item.assignedTechnicianId
                        ? 'rgba(16,185,129,0.12)'
                        : 'rgba(99,102,241,0.12)',
                      color: item.assignedTechnicianId ? '#10b981' : '#a5b4fc',
                      border: `1px solid ${item.assignedTechnicianId ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.25)'}`,
                    }}
                  >
                    <UserCheck size={12} />
                    {item.assignedTechnicianId ? 'Reassign Technician' : 'Assign Technician'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Technician Modal */}
      <Dialog open={assignModal.open} onOpenChange={(v) => setAssignModal({ open: v, asset: assignModal.asset })}>
        <DialogContent
          className="sm:max-w-[420px] rounded-2xl"
          style={{ background: 'rgba(13,21,37,0.98)', border: '1px solid rgba(148,163,184,0.12)', backdropFilter: 'blur(20px)' }}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2" style={{ color: '#e8eaf2' }}>
              <UserCheck size={17} style={{ color: '#6366f1' }} /> Assign Technician
            </DialogTitle>
            {assignModal.asset && (
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                Asset: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{assignModal.asset.name}</span>
              </p>
            )}
          </DialogHeader>
          <form onSubmit={handleAssign} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
                Select Technician
              </label>
              <select
                name="technicianId"
                className="w-full h-11 rounded-xl text-sm px-3 outline-none"
                style={darkInput}
                required
                defaultValue=""
              >
                <option value="" disabled>— Choose a technician —</option>
                {technicians.length === 0 ? (
                  <option disabled>No technicians available</option>
                ) : (
                  technicians.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))
                )}
              </select>
            </div>
            <div
              className="p-3 rounded-xl text-xs"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', color: '#94a3b8' }}
            >
              The assigned technician will be responsible for inspecting and repairing this asset.
            </div>
            <Button
              type="submit"
              className="w-full h-11 font-bold rounded-xl"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}
              disabled={assignTechnician.isPending}
            >
              {assignTechnician.isPending ? "Assigning..." : "Confirm Assignment →"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const darkInput: React.CSSProperties = {
  background: 'rgba(30,40,64,0.7)',
  border: '1px solid rgba(148,163,184,0.12)',
  color: '#e8eaf2',
};