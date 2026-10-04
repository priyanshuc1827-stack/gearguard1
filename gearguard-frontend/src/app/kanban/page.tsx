"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { format, isPast } from "date-fns";
import { ArrowRight, Trash2, Plus, UserCircle, Search, ShieldAlert, Wrench, CalendarDays, Edit3 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/custom/page-header";

const STAGES = ["New", "In Progress", "Repaired", "Scrap"];

export default function KanbanPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // States for the edit form
  const [editForm, setEditForm] = useState({
    subject: "",
    equipmentId: "",
    technicianId: "",
    type: "Corrective",
    date: "",
    status: "New",
    duration: 0
  });

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      setCurrentUser(JSON.parse(stored));
    }
  }, []);

  // 1. Fetch Maintenance Requests with Creator relations (conditional filtering for technicians)
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["requests", currentUser?.id, currentUser?.role],
    queryFn: async () => {
      const url = currentUser?.role === "technician"
        ? `${API_BASE}/maintenance/requests?userId=${currentUser.id}&role=technician`
        : `${API_BASE}/maintenance/requests`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!currentUser,
  });

  // 2. Fetch Equipment and Users for dropdowns
  const { data: assets = [] } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/equipment`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });
  const { data: dbUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/auth/users`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  // 3. Status Update, Create and Update Mutations
  const updateStatus = useMutation({
    mutationFn: ({ id, status, equipmentId }: any) =>
      fetch(`${API_BASE}/maintenance/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, equipmentId }),
      }).then((res) => res.json()),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      const statusMessages: Record<string, string> = {
        "In Progress": "Task moved to In Progress",
        "Repaired":    "Task marked as Repaired ✓",
        "Scrap":       "Asset marked as Scrap",
      };
      const msg = statusMessages[variables.status] || "Status updated";
      if (variables.status === "Scrap") toast.warning(msg);
      else if (variables.status === "Repaired") toast.success(msg);
      else toast.info(msg);
    },
    onError: () => toast.error("Failed to update status"),
  });

  const createTask = useMutation({
    mutationFn: (newTask: any) =>
      fetch(`${API_BASE}/maintenance/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setIsModalOpen(false);
      toast.success("Maintenance request created");
    },
    onError: () => toast.error("Failed to create request"),
  });

  const updateTaskDetails = useMutation({
    mutationFn: ({ id, updatedData }: any) =>
      fetch(`${API_BASE}/maintenance/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setIsEditModalOpen(false);
      setSelectedTask(null);
      toast.success("Task details updated");
    },
    onError: () => toast.error("Failed to update task"),
  });

  const handleCreateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createTask.mutate({
      subject: formData.get("subject"),
      equipmentId: formData.get("equipmentId") as string,
      createdBy: formData.get("technicianId"),
      type: formData.get("type"),
      scheduledDate: new Date(formData.get("date") as string).toISOString(),
    });
  };

  const handleCardClick = (task: any) => {
    setSelectedTask(task);
    setEditForm({
      subject: task.subject || "",
      equipmentId: task.equipmentId || "",
      technicianId: task.createdBy || "",
      type: task.type || "Corrective",
      date: task.scheduledDate ? new Date(task.scheduledDate).toISOString().split("T")[0] : "",
      status: task.status || "New",
      duration: task.duration || 0
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    let updatedFields: any = {};
    if (currentUser?.role === "admin" || currentUser?.role === "manager") {
      updatedFields = {
        subject: editForm.subject,
        equipmentId: editForm.equipmentId,
        createdBy: editForm.technicianId,
        type: editForm.type,
        scheduledDate: editForm.date ? new Date(editForm.date).toISOString() : null,
        status: editForm.status,
        duration: Number(editForm.duration)
      };
    } else if (currentUser?.role === "technician") {
      // Technician can modify tasks that are assigned to them (status, duration)
      updatedFields = {
        status: editForm.status,
        duration: Number(editForm.duration)
      };
    }

    updateTaskDetails.mutate({ id: selectedTask.id, updatedData: updatedFields });
  };

  // 4. DYNAMIC FILTER LOGIC
  const safeRequests = Array.isArray(requests) ? requests : [];
  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeUsers = Array.isArray(dbUsers) ? dbUsers : [];

  const filteredRequests = safeRequests.filter((req: any) => {
    const technicianName = req.creator?.name?.toLowerCase() || "unassigned";
    return technicianName.includes(searchQuery.toLowerCase());
  });

  // Filter users lists to only display technicians in dropdown
  const techniciansOnly = safeUsers.filter((u: any) => u.role === "technician");

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: '#f59e0b', borderTopColor: 'transparent' }} />
        <p className="text-sm font-medium" style={{ color: '#64748b' }}>Loading maintenance board...</p>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Read-Only Auditor View Warning banner */}
      {currentUser?.role === "auditor" && (
        <div className="mb-4 p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 text-left"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#fcd34d' }}
        >
          <ShieldAlert size={18} className="animate-pulse shrink-0" style={{ color: '#f59e0b' }} />
          <span><strong>Auditor View:</strong> You have read-only access to inspect all current works. Creation and status modifications are restricted.</span>
        </div>
      )}

      <PageHeader
        title={currentUser?.role === "technician" ? "My Maintenance Tasks" : "Maintenance Kanban"}
        subtitle={currentUser?.role === "technician" ? "Track and update your assigned work tickets" : "Manage facility workflows, schedule corrective works, and allocate technicians"}
        icon={<Wrench size={20} />}
        accentColor="#f59e0b"
        actions={
          <div className="flex items-center gap-3">
            {currentUser?.role !== "technician" && (
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#475569' }} />
                <Input
                  placeholder="Filter by technician..."
                  className="pl-9 h-9 rounded-xl text-sm"
                  style={{ background: 'rgba(30,40,64,0.6)', border: '1px solid rgba(148,163,184,0.12)', color: '#e8eaf2' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}
            {(currentUser?.role === "admin" || currentUser?.role === "manager") && (
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-glow gap-2 h-9 px-4 text-sm font-bold rounded-xl">
                    <Plus size={16} /> New Request
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className="text-left max-w-md rounded-2xl"
                  style={{ background: 'rgba(13,21,37,0.98)', border: '1px solid rgba(148,163,184,0.12)', backdropFilter: 'blur(20px)' }}
                >
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2" style={{ color: '#e8eaf2' }}>
                      <Plus size={18} style={{ color: '#10b981' }} /> Create Maintenance Request
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
                    <DarkField label="Issue / Subject">
                      <Input name="subject" placeholder="What needs to be fixed?" className="h-11 rounded-xl text-sm" style={darkInput} required />
                    </DarkField>
                    <DarkField label="Select Asset">
                      <select name="equipmentId" style={{ ...darkInput, height: '44px', padding: '0 12px', borderRadius: '12px', width: '100%', fontSize: '13px' }} required>
                        <option value="" style={{ background: '#0d1525' }}>-- Choose Asset --</option>
                        {safeAssets.map((a: any) => <option key={a.id} value={a.id} style={{ background: '#0d1525' }}>{a.name} ({a.serialNumber})</option>)}
                      </select>
                    </DarkField>
                    <DarkField label="Assign Technician">
                      <select name="technicianId" style={{ ...darkInput, height: '44px', padding: '0 12px', borderRadius: '12px', width: '100%', fontSize: '13px' }} required>
                        <option value="" style={{ background: '#0d1525' }}>-- Choose Technician --</option>
                        {techniciansOnly.map((user: any) => (
                          <option key={user.id} value={user.id} style={{ background: '#0d1525' }}>{user.name} ({user.email})</option>
                        ))}
                      </select>
                    </DarkField>
                    <div className="grid grid-cols-2 gap-4">
                      <DarkField label="Maintenance Type">
                        <select name="type" style={{ ...darkInput, height: '44px', padding: '0 12px', borderRadius: '12px', width: '100%', fontSize: '13px' }}>
                          <option value="Corrective" style={{ background: '#0d1525' }}>Corrective</option>
                          <option value="Preventive" style={{ background: '#0d1525' }}>Preventive</option>
                        </select>
                      </DarkField>
                      <DarkField label="Schedule Date">
                        <Input name="date" type="date" className="h-11 rounded-xl text-sm" style={darkInput} required />
                      </DarkField>
                    </div>
                    <Button type="submit" className="w-full h-11 mt-1 btn-glow font-bold rounded-xl" disabled={createTask.isPending}>
                      {createTask.isPending ? "Creating..." : "Create Request"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />
      
      <div className="flex gap-4 overflow-x-auto flex-1 pb-4">
        {STAGES.map((stage) => {
          const stageRequests = filteredRequests.filter((r: any) => r.status === stage);
          return (
            <div
              key={stage}
              className="flex-1 min-w-[310px] rounded-2xl p-4 flex flex-col"
              style={{
                background: "rgba(13,21,37,0.7)",
                border: `1px solid ${
                  stage === 'New' ? 'rgba(99,102,241,0.2)' :
                  stage === 'In Progress' ? 'rgba(245,158,11,0.2)' :
                  stage === 'Repaired' ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'
                }`,
                borderTop: `2px solid ${
                  stage === 'New' ? '#6366f1' :
                  stage === 'In Progress' ? '#f59e0b' :
                  stage === 'Repaired' ? '#10b981' : '#f43f5e'
                }`,
              }}
            >
              <div className="flex justify-between items-center mb-4 px-1">
                <h2 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2" style={{ color: '#94a3b8' }}>
                  <span className="beacon" style={{
                    background: stage === 'New' ? '#6366f1' : stage === 'In Progress' ? '#f59e0b' : stage === 'Repaired' ? '#10b981' : '#f43f5e',
                    color: stage === 'New' ? '#6366f1' : stage === 'In Progress' ? '#f59e0b' : stage === 'Repaired' ? '#10b981' : '#f43f5e',
                  }} />
                  {stage}
                </h2>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(30,40,64,0.8)',
                    color: '#64748b',
                    border: '1px solid rgba(148,163,184,0.1)'
                  }}
                >
                  {stageRequests.length}
                </span>
              </div>

              <div className="space-y-3 overflow-y-auto pr-1 flex-1 max-h-[calc(100vh-230px)]">
                {stageRequests.map((req: any) => {
                  const overdue = req.scheduledDate && isPast(new Date(req.scheduledDate)) && req.status !== 'Repaired';
                  return (
                    <div
                    key={req.id}
                    onClick={() => handleCardClick(req)}
                    className="rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-1 p-3.5 space-y-2.5"
                    style={{
                      background: "rgba(19,25,41,0.9)",
                      border: `1px solid ${overdue ? 'rgba(244,63,94,0.3)' : 'rgba(148,163,184,0.08)'}`,
                      borderLeft: `3px solid ${overdue ? '#f43f5e' : stage === 'New' ? '#6366f1' : stage === 'In Progress' ? '#f59e0b' : stage === 'Repaired' ? '#10b981' : '#f43f5e'}`,
                    }}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm font-bold line-clamp-2 text-left tracking-tight leading-snug" style={{ color: '#e8eaf2' }}>{req.subject}</p>
                      <span
                        className="text-[8px] font-extrabold uppercase px-2 py-0.5 whitespace-nowrap rounded shrink-0"
                        style={req.type === 'Corrective'
                          ? { background: 'rgba(244,63,94,0.15)', color: '#fda4af', border: '1px solid rgba(244,63,94,0.25)' }
                          : { background: 'rgba(6,182,212,0.15)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.25)' }
                        }
                      >
                        {req.type}
                      </span>
                    </div>
                    <div
                      className="text-[11px] p-2 rounded-lg font-medium text-left"
                      style={{ background: 'rgba(30,40,64,0.7)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.06)' }}
                    >
                      {req.equipment?.name || `Asset #${req.equipmentId}`}
                    </div>

                    {req.scheduledDate && (
                      <div className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: '#64748b' }}>
                        <CalendarDays size={12} style={{ color: '#475569' }} />
                        <span>Due: {format(new Date(req.scheduledDate), "MMM dd, yyyy")}</span>
                        {overdue && <span className="font-extrabold" style={{ color: '#f43f5e' }}>(OVERDUE)</span>}
                      </div>
                    )}

                    <div
                      className="flex justify-between items-center pt-2"
                      style={{ borderTop: '1px solid rgba(148,163,184,0.06)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback
                            className="text-[8px] font-extrabold uppercase"
                            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
                          >
                            {req.creator?.name?.substring(0, 2) || <UserCircle size={12}/>}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col text-left">
                          <span className="text-[10px] font-semibold leading-tight" style={{ color: '#94a3b8' }}>{req.creator?.name || "Unassigned"}</span>
                          <span className="text-[8px] font-mono leading-none" style={{ color: '#334155' }}>{"#"}{req.createdBy?.substring(req.createdBy.length - 6) || "N/A"}</span>
                        </div>
                      </div>
                      {currentUser?.role !== "auditor" && (
                        <div className="flex gap-1 shrink-0">
                          {stage === "New" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" style={{ color: '#6366f1' }} onClick={() => updateStatus.mutate({ id: req.id, status: "In Progress" })}>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                          {stage === "In Progress" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" style={{ color: '#10b981' }} onClick={() => updateStatus.mutate({ id: req.id, status: "Repaired" })}>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                          {stage !== "Scrap" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" style={{ color: '#f43f5e' }} onClick={() => updateStatus.mutate({ id: req.id, status: "Scrap", equipmentId: req.equipmentId })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* EDIT/MODIFY TASK DIALOG */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent
          className="text-left max-w-md rounded-2xl"
          style={{ background: 'rgba(13,21,37,0.98)', border: '1px solid rgba(148,163,184,0.12)', backdropFilter: 'blur(20px)' }}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2" style={{ color: '#e8eaf2' }}>
              <Edit3 size={17} style={{ color: '#10b981' }} />
              {currentUser?.role === "auditor" ? "View Task Details" : "Modify Task Details"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateTask} className="space-y-4 pt-2">
            {(currentUser?.role === "admin" || currentUser?.role === "manager") ? (
              <>
                <DarkField label="Issue / Subject">
                  <Input value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} className="h-11 rounded-xl text-sm" style={darkInput} required />
                </DarkField>
                <DarkField label="Select Asset">
                  <select value={editForm.equipmentId} onChange={(e) => setEditForm({ ...editForm, equipmentId: e.target.value })} style={{ ...darkInput, height: '44px', padding: '0 12px', borderRadius: '12px', width: '100%', fontSize: '13px' }} required>
                    <option value="" style={{ background: '#0d1525' }}>-- Choose Asset --</option>
                    {safeAssets.map((a: any) => <option key={a.id} value={a.id} style={{ background: '#0d1525' }}>{a.name} ({a.serialNumber})</option>)}
                  </select>
                </DarkField>
                <DarkField label="Assign Technician">
                  <select value={editForm.technicianId} onChange={(e) => setEditForm({ ...editForm, technicianId: e.target.value })} style={{ ...darkInput, height: '44px', padding: '0 12px', borderRadius: '12px', width: '100%', fontSize: '13px' }} required>
                    <option value="" style={{ background: '#0d1525' }}>-- Choose Technician --</option>
                    {techniciansOnly.map((user: any) => (
                      <option key={user.id} value={user.id} style={{ background: '#0d1525' }}>{user.name} ({user.email})</option>
                    ))}
                  </select>
                </DarkField>
                <div className="grid grid-cols-2 gap-4">
                  <DarkField label="Type">
                    <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} style={{ ...darkInput, height: '44px', padding: '0 12px', borderRadius: '12px', width: '100%', fontSize: '13px' }}>
                      <option value="Corrective" style={{ background: '#0d1525' }}>Corrective</option>
                      <option value="Preventive" style={{ background: '#0d1525' }}>Preventive</option>
                    </select>
                  </DarkField>
                  <DarkField label="Schedule Date">
                    <Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="h-11 rounded-xl text-sm" style={darkInput} required />
                  </DarkField>
                </div>
              </>
            ) : (
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(30,40,64,0.5)', border: '1px solid rgba(148,163,184,0.08)' }}>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Issue</span>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: '#e8eaf2' }}>{selectedTask?.subject}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Asset</span>
                    <p className="text-xs font-medium mt-0.5" style={{ color: '#94a3b8' }}>{selectedTask?.equipment?.name || "Unassigned"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Type</span>
                    <p className="text-xs font-medium mt-0.5" style={{ color: '#94a3b8' }}>{selectedTask?.type}</p>
                  </div>
                </div>
              </div>
            )}

            {currentUser?.role !== "auditor" ? (
              <div className="grid grid-cols-2 gap-4 pt-2" style={{ borderTop: '1px solid rgba(148,163,184,0.08)' }}>
                <DarkField label="Status">
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} style={{ ...darkInput, height: '44px', padding: '0 12px', borderRadius: '12px', width: '100%', fontSize: '13px' }}>
                    {STAGES.map((s) => <option key={s} value={s} style={{ background: '#0d1525' }}>{s}</option>)}
                  </select>
                </DarkField>
                <DarkField label="Duration (hrs)">
                  <Input type="number" min={0} step={0.5} value={editForm.duration} onChange={(e) => setEditForm({ ...editForm, duration: Number(e.target.value) })} className="h-11 rounded-xl text-sm" style={darkInput} required />
                </DarkField>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 rounded-xl p-4" style={{ background: 'rgba(30,40,64,0.5)', border: '1px solid rgba(148,163,184,0.08)' }}>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Status</span>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: '#e8eaf2' }}>{selectedTask?.status}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Labor Hours</span>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: '#e8eaf2' }}>{selectedTask?.duration || 0} hrs</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2" style={{ borderTop: '1px solid rgba(148,163,184,0.08)' }}>
              <Button type="button" variant="ghost" className="text-sm" style={{ color: '#64748b' }} onClick={() => setIsEditModalOpen(false)}>
                {currentUser?.role === "auditor" ? "Close" : "Cancel"}
              </Button>
              {currentUser?.role !== "auditor" && (
                <Button type="submit" className="btn-glow text-sm font-bold rounded-xl px-6" disabled={updateTaskDetails.isPending}>
                  {updateTaskDetails.isPending ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shared dark form styles ─────────────────────────────────────────────────
const darkInput: React.CSSProperties = {
  background: 'rgba(30,40,64,0.7)',
  border: '1px solid rgba(148,163,184,0.12)',
  color: '#e8eaf2',
};

function DarkField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: '#475569' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}