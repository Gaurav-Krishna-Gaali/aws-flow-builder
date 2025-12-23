'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Download, 
  Trash2, 
  ChevronDown, 
  Search, 
  X,
  CheckCircle2,
  BarChart3,
  FileText
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

// Types
interface Workflow {
  stateMachineArn: string;
  name: string;
  status?: string;
  creationDate?: Date;
  definition?: unknown;
  type?: string;
}

interface Execution {
  executionArn: string;
  name?: string;
  status: string;
  startDate: Date;
  stopDate?: Date;
  stateMachineArn?: string;
}

interface ExecutionDetails extends Execution {
  input?: unknown;
  output?: unknown;
  error?: string;
  cause?: string;
}

export default function Dashboard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [selectedWorkflowForExecution, setSelectedWorkflowForExecution] = useState<Workflow | null>(null);
  const [executionInput, setExecutionInput] = useState('{}');
  const [isStartingExecution, setIsStartingExecution] = useState(false);
  const [showExecutionDetails, setShowExecutionDetails] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionDetails | null>(null);
  const [workflowExecutions, setWorkflowExecutions] = useState<Record<string, Execution[]>>({});
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState<Record<string, boolean>>({});
  const [exportFormat, setExportFormat] = useState<'json' | 'yaml'>('json');
  const [showExportModal, setShowExportModal] = useState(false);
  const [workflowToExport, setWorkflowToExport] = useState<Workflow | null>(null);
  const [isStoppingExecution, setIsStoppingExecution] = useState<string | null>(null);

  // Mock data for demonstration (replace with actual API call)
  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      // In production, this would be: fetch(`${API_BASE_URL}/state-machines`)
      // For now, using mock data
      const mockWorkflows: Workflow[] = [
        {
          stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:OrderProcessing',
          name: 'OrderProcessing',
          status: 'ACTIVE',
          creationDate: new Date('2024-01-15'),
          type: 'STANDARD',
        },
        {
          stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:DataPipeline',
          name: 'DataPipeline',
          status: 'ACTIVE',
          creationDate: new Date('2024-01-20'),
          type: 'STANDARD',
        },
        {
          stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:NotificationService',
          name: 'NotificationService',
          status: 'ACTIVE',
          creationDate: new Date('2024-02-01'),
          type: 'EXPRESS',
        },
      ];
      setWorkflows(mockWorkflows);
      setIsLoading(false);
    }, 500);
  }, []);

  const filteredWorkflows = workflows.filter((workflow) => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         workflow.stateMachineArn.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleWorkflowSelection = (arn: string) => {
    setSelectedWorkflows((prev) => {
      const next = new Set(prev);
      if (next.has(arn)) {
        next.delete(arn);
      } else {
        next.add(arn);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedWorkflows.size === filteredWorkflows.length) {
      setSelectedWorkflows(new Set());
    } else {
      setSelectedWorkflows(new Set(filteredWorkflows.map((w) => w.stateMachineArn)));
    }
  };

  const handleDeleteClick = (arn: string) => {
    setWorkflowToDelete(arn);
    setShowDeleteModal(true);
  };

  const handleBulkDelete = () => {
    if (selectedWorkflows.size === 0) return;
    setWorkflowToDelete(Array.from(selectedWorkflows)[0]);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!workflowToDelete) return;

    setIsDeleting(true);
    try {
      // Delete single workflow
      if (selectedWorkflows.size <= 1) {
        const response = await fetch(
          `${API_BASE_URL}/state-machines?stateMachineArn=${encodeURIComponent(workflowToDelete)}`,
          { method: 'DELETE' }
        );

        if (response.ok) {
          setWorkflows((prev) => prev.filter((w) => w.stateMachineArn !== workflowToDelete));
          setSelectedWorkflows((prev) => {
            const next = new Set(prev);
            next.delete(workflowToDelete);
            return next;
          });
        }
      } else {
        // Bulk delete
        const deletePromises = Array.from(selectedWorkflows).map((arn) =>
          fetch(`${API_BASE_URL}/state-machines?stateMachineArn=${encodeURIComponent(arn)}`, {
            method: 'DELETE',
          })
        );
        await Promise.all(deletePromises);
        setWorkflows((prev) => prev.filter((w) => !selectedWorkflows.has(w.stateMachineArn)));
        setSelectedWorkflows(new Set());
      }
    } catch (error) {
      console.error('Error deleting workflow:', error);
      alert('Failed to delete workflow(s)');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setWorkflowToDelete(null);
    }
  };

  const loadExecutions = async (workflowArn: string) => {
    setIsLoadingExecutions((prev) => ({ ...prev, [workflowArn]: true }));
    try {
      const response = await fetch(
        `${API_BASE_URL}/executions?stateMachineArn=${encodeURIComponent(workflowArn)}&maxResults=10`
      );
      const result = await response.json();
      if (response.ok) {
        setWorkflowExecutions((prev) => ({
          ...prev,
          [workflowArn]: result.executions || [],
        }));
      }
    } catch (error) {
      console.error('Error loading executions:', error);
    } finally {
      setIsLoadingExecutions((prev) => ({ ...prev, [workflowArn]: false }));
    }
  };

  const toggleWorkflowExpansion = (arn: string) => {
    if (expandedWorkflow === arn) {
      setExpandedWorkflow(null);
    } else {
      setExpandedWorkflow(arn);
      if (!workflowExecutions[arn]) {
        loadExecutions(arn);
      }
    }
  };

  const handleStartExecution = (workflow: Workflow) => {
    setSelectedWorkflowForExecution(workflow);
    setExecutionInput('{}');
    setShowExecutionModal(true);
  };

  const confirmStartExecution = async () => {
    if (!selectedWorkflowForExecution) return;

    setIsStartingExecution(true);
    try {
      let input: unknown = {};
      try {
        input = JSON.parse(executionInput);
      } catch {
        alert('Invalid JSON input');
        setIsStartingExecution(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/executions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stateMachineArn: selectedWorkflowForExecution.stateMachineArn,
          input,
        }),
      });

      const result = await response.json();
      if (response.ok) {
        // Reload executions
        await loadExecutions(selectedWorkflowForExecution.stateMachineArn);
        setShowExecutionModal(false);
        setSelectedWorkflowForExecution(null);
        // Auto-expand to show new execution
        setExpandedWorkflow(selectedWorkflowForExecution.stateMachineArn);
      } else {
        alert(result.error || 'Failed to start execution');
      }
    } catch (error) {
      console.error('Error starting execution:', error);
      alert('Failed to start execution');
    } finally {
      setIsStartingExecution(false);
    }
  };

  const viewExecutionDetails = async (executionArn: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/executions/${encodeURIComponent(executionArn)}`);
      const result = await response.json();
      if (response.ok) {
        setSelectedExecution(result);
        setShowExecutionDetails(true);
      }
    } catch (error) {
      console.error('Error loading execution details:', error);
    }
  };

  const handleExport = (workflow: Workflow) => {
    setWorkflowToExport(workflow);
    setShowExportModal(true);
  };

  const confirmExport = () => {
    if (!workflowToExport) return;

    // In a real app, you'd fetch the definition from the API
    const definition = workflowToExport.definition || {};
    const exportData = {
      name: workflowToExport.name,
      stateMachineArn: workflowToExport.stateMachineArn,
      definition,
    };

    const content = exportFormat === 'json'
      ? JSON.stringify(exportData, null, 2)
      : `name: ${workflowToExport.name}\narn: ${workflowToExport.stateMachineArn}\ndefinition:\n  ${JSON.stringify(definition, null, 2).split('\n').join('\n  ')}`;

    const blob = new Blob([content], {
      type: exportFormat === 'json' ? 'application/json' : 'text/yaml',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowToExport.name}.${exportFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setShowExportModal(false);
    setWorkflowToExport(null);
  };

  const handleStopExecution = async (executionArn: string, workflowArn: string) => {
    setIsStoppingExecution(executionArn);
    try {
      // Note: Backend endpoint needs to be implemented: DELETE /executions/:executionArn
      const response = await fetch(`${API_BASE_URL}/executions/${encodeURIComponent(executionArn)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Reload executions to reflect the stopped status
        await loadExecutions(workflowArn);
      } else {
        const result = await response.json();
        alert(result.error || 'Failed to stop execution');
      }
    } catch (error) {
      console.error('Error stopping execution:', error);
      alert('Failed to stop execution. Backend endpoint may not be implemented yet.');
    } finally {
      setIsStoppingExecution(null);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'DELETING':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-white/10 text-white/60 border-white/20';
    }
  };

  const getExecutionStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return 'bg-green-500/20 text-green-400';
      case 'FAILED':
        return 'bg-red-500/20 text-red-400';
      case 'RUNNING':
        return 'bg-blue-500/20 text-blue-400';
      case 'TIMED_OUT':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'ABORTED':
        return 'bg-white/10 text-white/60';
      default:
        return 'bg-white/10 text-white/60';
    }
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-black border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-xl font-bold text-white">
                FlowBuilder
              </Link>
              <span className="text-sm text-white/60">Dashboard</span>
            </div>
            <Button asChild variant="default">
              <Link href="/">
                + New Workflow
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white/5 border-white/10 hover:border-white/20 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white/60">Total Workflows</p>
                  <p className="text-2xl font-bold text-white mt-1">{workflows.length}</p>
                </div>
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 hover:border-white/20 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white/60">Active</p>
                  <p className="text-2xl font-bold text-green-400 mt-1">
                    {workflows.filter((w) => w.status === 'ACTIVE').length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center border border-green-500/30">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 hover:border-white/20 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white/60">Running Executions</p>
                  <p className="text-2xl font-bold text-blue-400 mt-1">
                    {Object.values(workflowExecutions).flat().filter((e) => e.status === 'RUNNING').length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                  <Play className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 hover:border-white/20 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white/60">Total Executions</p>
                  <p className="text-2xl font-bold text-purple-400 mt-1">
                    {Object.values(workflowExecutions).flat().length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center border border-purple-500/30">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between w-full">
            <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
              {/* Search */}
              <div className="flex-1 relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-white/40" />
                </div>
                <Input
                  type="text"
                  placeholder="Search workflows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-white/30 w-full"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="bg-black border-white/10">
                  <SelectItem value="all" className="text-white">All Status</SelectItem>
                  <SelectItem value="ACTIVE" className="text-white">Active</SelectItem>
                  <SelectItem value="DELETING" className="text-white">Deleting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bulk Actions */}
            {selectedWorkflows.size > 0 && (
              <Button
                onClick={handleBulkDelete}
                variant="destructive"
                size="sm"
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedWorkflows.size})
              </Button>
            )}
          </div>
        </div>

        {/* Workflows List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400"></div>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <Card className="bg-white/5 border-white/10 p-12 text-center">
            <CardContent>
              <FileText className="mx-auto h-12 w-12 text-white/40" />
              <h3 className="mt-4 text-lg font-medium text-white">No workflows found</h3>
              <p className="mt-2 text-sm text-white/60">
                {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Get started by creating a new workflow'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button asChild className="mt-6">
                  <Link href="/">Create Workflow</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredWorkflows.map((workflow) => (
              <Card key={workflow.stateMachineArn} className="bg-white/5 border-white/10 hover:border-white/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedWorkflows.has(workflow.stateMachineArn)}
                        onChange={() => toggleWorkflowSelection(workflow.stateMachineArn)}
                        className="mt-1 h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-slate-600 bg-slate-900 rounded"
                      />

                      {/* Workflow Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="text-base font-semibold text-white">{workflow.name}</h3>
                          <Badge variant={workflow.status === 'ACTIVE' ? 'default' : 'secondary'} className={`${getStatusColor(workflow.status)} text-xs`}>
                            {workflow.status || 'UNKNOWN'}
                          </Badge>
                          {workflow.type && (
                            <Badge variant="outline" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs">
                              {workflow.type}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-white/50 font-mono truncate">{workflow.stateMachineArn}</p>
                        <p className="text-xs text-white/40 mt-0.5">Created {formatDate(workflow.creationDate)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        onClick={() => handleStartExecution(workflow)}
                        variant="ghost"
                        size="icon"
                        title="Start Execution"
                      >
                        <Play className="w-5 h-5" />
                      </Button>
                      <Button
                        onClick={() => handleExport(workflow)}
                        variant="ghost"
                        size="icon"
                        title="Export"
                      >
                        <Download className="w-5 h-5" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteClick(workflow.stateMachineArn)}
                        variant="ghost"
                        size="icon"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                      <Button
                        onClick={() => toggleWorkflowExpansion(workflow.stateMachineArn)}
                        variant="ghost"
                        size="icon"
                        title="View Executions"
                      >
                        <ChevronDown className={`w-5 h-5 transition-transform ${expandedWorkflow === workflow.stateMachineArn ? 'rotate-180' : ''}`} />
                      </Button>
                    </div>
                  </div>

                  {/* Executions Panel */}
                  {expandedWorkflow === workflow.stateMachineArn && (
                    <div className="mt-4 pt-4">
                      <Separator className="mb-3 bg-white/10" />
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-white/80">Recent Executions</h4>
                        {isLoadingExecutions[workflow.stateMachineArn] && (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white/60"></div>
                        )}
                      </div>
                      {workflowExecutions[workflow.stateMachineArn]?.length > 0 ? (
                        <div className="space-y-2">
                          {workflowExecutions[workflow.stateMachineArn].map((execution) => (
                            <Card key={execution.executionArn} className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                              <CardContent className="p-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Badge className={`${getExecutionStatusColor(execution.status)} text-xs`}>
                                      {execution.status}
                                    </Badge>
                                    <span className="text-xs font-mono truncate text-white/80">
                                      {execution.name || execution.executionArn.split(':').pop()}
                                    </span>
                                    <span className="text-xs text-white/40 ml-auto">
                                      {formatDate(execution.startDate)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 ml-3">
                                    {execution.status === 'RUNNING' && (
                                      <Button
                                        onClick={() => handleStopExecution(execution.executionArn, workflow.stateMachineArn)}
                                        disabled={isStoppingExecution === execution.executionArn}
                                        variant="destructive"
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        title="Stop Execution"
                                      >
                                        {isStoppingExecution === execution.executionArn ? (
                                          <>
                                            <div className="animate-spin rounded-full h-2.5 w-2.5 border-b-2 border-white mr-1"></div>
                                            Stopping...
                                          </>
                                        ) : (
                                          <>
                                            <X className="w-3 h-3 mr-1" />
                                            Stop
                                          </>
                                        )}
                                      </Button>
                                    )}
                                    <Button
                                      onClick={() => viewExecutionDetails(execution.executionArn)}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs px-2 border-white/20 text-white/80 hover:bg-white/10"
                                    >
                                      View Details
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-white/40 text-center py-3">No executions yet</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workflow{selectedWorkflows.size > 1 ? 's' : ''}?</DialogTitle>
            <DialogDescription>
              {selectedWorkflows.size > 1
                ? `Are you sure you want to delete ${selectedWorkflows.size} workflows? This action cannot be undone.`
                : 'Are you sure you want to delete this workflow? This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setWorkflowToDelete(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Execution Modal */}
      <Dialog open={showExecutionModal} onOpenChange={(open) => {
        if (!open) {
          setShowExecutionModal(false);
          setSelectedWorkflowForExecution(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start Execution</DialogTitle>
            <DialogDescription>
              Workflow: <span className="font-mono text-xs">{selectedWorkflowForExecution?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Input (JSON)</label>
            <Textarea
              value={executionInput}
              onChange={(e) => setExecutionInput(e.target.value)}
              className="h-32 font-mono"
              placeholder='{"key": "value"}'
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowExecutionModal(false);
                setSelectedWorkflowForExecution(null);
              }}
              disabled={isStartingExecution}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmStartExecution}
              disabled={isStartingExecution}
            >
              {isStartingExecution ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Execution
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Execution Details Modal */}
      <Dialog open={showExecutionDetails} onOpenChange={(open) => {
        if (!open) {
          setShowExecutionDetails(false);
          setSelectedExecution(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execution Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge className={selectedExecution ? getExecutionStatusColor(selectedExecution.status) : ''}>
                    {selectedExecution?.status || 'N/A'}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Execution ARN</label>
                <p className="mt-1 text-sm font-mono break-all">{selectedExecution?.executionArn || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                <p className="mt-1 text-sm">{selectedExecution?.startDate ? formatDate(selectedExecution.startDate) : 'N/A'}</p>
              </div>
              {selectedExecution?.stopDate && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stop Date</label>
                  <p className="mt-1 text-sm">{formatDate(selectedExecution.stopDate)}</p>
                </div>
              )}
            </div>
            {selectedExecution?.input !== undefined && selectedExecution?.input !== null && (
              <div>
                <label className="text-sm font-medium mb-2 block">Input</label>
                <pre className="bg-muted border p-4 rounded-lg overflow-x-auto text-xs font-mono">
                  {String(typeof selectedExecution.input === 'string' 
                    ? selectedExecution.input 
                    : JSON.stringify(selectedExecution.input, null, 2))}
                </pre>
              </div>
            )}
            {selectedExecution?.output !== undefined && selectedExecution?.output !== null && (
              <div>
                <label className="text-sm font-medium mb-2 block">Output</label>
                <pre className="bg-muted border p-4 rounded-lg overflow-x-auto text-xs font-mono">
                  {String(typeof selectedExecution.output === 'string' 
                    ? selectedExecution.output 
                    : JSON.stringify(selectedExecution.output, null, 2))}
                </pre>
              </div>
            )}
            {selectedExecution?.error && (
              <div>
                <label className="text-sm font-medium text-destructive mb-2 block">Error</label>
                <pre className="bg-destructive/10 border border-destructive/30 p-4 rounded-lg overflow-x-auto text-xs font-mono text-destructive">
                  {String(selectedExecution.error)}
                </pre>
              </div>
            )}
            {selectedExecution?.cause && (
              <div>
                <label className="text-sm font-medium text-destructive mb-2 block">Cause</label>
                <pre className="bg-destructive/10 border border-destructive/30 p-4 rounded-lg overflow-x-auto text-xs font-mono text-destructive">
                  {String(selectedExecution.cause)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Modal */}
      <Dialog open={showExportModal} onOpenChange={(open) => {
        if (!open) {
          setShowExportModal(false);
          setWorkflowToExport(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Workflow</DialogTitle>
            <DialogDescription>
              Export <span className="font-mono text-xs">{workflowToExport?.name}</span> in your preferred format.
            </DialogDescription>
          </DialogHeader>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Format</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="json"
                  checked={exportFormat === 'json'}
                  onChange={(e) => setExportFormat(e.target.value as 'json' | 'yaml')}
                  className="mr-2"
                />
                JSON
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="yaml"
                  checked={exportFormat === 'yaml'}
                  onChange={(e) => setExportFormat(e.target.value as 'json' | 'yaml')}
                  className="mr-2"
                />
                YAML
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowExportModal(false);
                setWorkflowToExport(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={confirmExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

