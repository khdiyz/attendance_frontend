import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Typography,
  Box,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Modal,
  Stack,
  Divider,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  StyledTableCell,
  EmployeeCell,
  PaginationContainer,
  PageIndicator,
  StyledButtonGroup,
  StyledButton,
  StyledCheckbox,
} from './NewTableStyles';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

interface DepartmentData {
  department_name: string;
  display_number: number;
  result: EmployeeData[];
}

interface EmployeeData {
  id: number;
  employee_id: string;
  department_id: number;
  department_name: string;
  display_number: number;
  last_name: string;
  nick_name?: string;
  status: boolean;
}

const SOCKET_URL = 'ws://104.248.251.150:8080/api/v1/user/dashboardlist/ws';

const NewDepartmentTable: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const { t } = useTranslation(['admin']);

  const maxColumnsPerPage = 10;
  const maxEmployeesPerColumn = 20;

  const wsRef = useRef<WebSocket | null>(null);

  const formatName = (employee: EmployeeData): string => {
    if (!employee.last_name) {
      return employee.nick_name || '';
    }

    if (employee.last_name.length > 7) {
      return employee.nick_name || employee.last_name.substring(0, 7);
    }

    return employee.last_name;
  };

  const initializeWebSocket = () => {
    wsRef.current = new WebSocket(SOCKET_URL);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      setLoading(true);
      setError(null);
    };

    wsRef.current.onmessage = (event: MessageEvent) => {
      try {
        const fullResponse = JSON.parse(event.data);
        const data = fullResponse.data;

        if (data && Array.isArray(data)) {
          setDepartmentData(data);
          if (selectedDepartments.size === 0) {
            setSelectedDepartments(new Set(data.map((dept: DepartmentData) => dept.department_name)));
          }
          setError(null);
        } else {
          setError('No data available.');
        }
      } catch (parseError) {
        console.error('Error parsing WebSocket message:', parseError);
        setError('Error processing data.');
      } finally {
        setLoading(false);
      }
    };

    wsRef.current.onerror = (event: Event) => {
      console.error('WebSocket error:', event);
      setError('Connection error.');
      setLoading(false);
    };

    wsRef.current.onclose = (event: CloseEvent) => {
      console.log('WebSocket closed:', event.reason);
      setError('Connection closed.');
    };
  };

  useEffect(() => {
    initializeWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const isAllSelected = useMemo(() => {
    return departmentData.length > 0 && selectedDepartments.size === departmentData.length;
  }, [departmentData, selectedDepartments]);

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedDepartments(new Set());
    } else {
      setSelectedDepartments(new Set(departmentData.map((dept: DepartmentData) => dept.department_name)));
    }
    setCurrentPage(1);
  };

  const handleReset = () => {
    setSelectedDepartments(new Set(departmentData.map((dept: DepartmentData) => dept.department_name)));
    setCurrentPage(1);
  };

  const handleDepartmentToggle = (deptName: string) => {
    setSelectedDepartments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(deptName)) {
        newSet.delete(deptName);
      } else {
        newSet.add(deptName);
      }
      return newSet;
    });
    setCurrentPage(1);
  };

  const filteredDepartmentData = useMemo(() => {
    return departmentData.filter((dept: DepartmentData) => selectedDepartments.has(dept.department_name));
  }, [departmentData, selectedDepartments]);

  const pages = useMemo(() => {
    const result: DepartmentData[][] = [];
    let currentPageDepts: DepartmentData[] = [];
    let currentCol = 0;

    filteredDepartmentData.forEach((dept) => {
      const columnsNeeded = Math.ceil(dept.result.length / maxEmployeesPerColumn);

      if (currentCol + columnsNeeded > maxColumnsPerPage) {
        if (currentPageDepts.length > 0) {
          result.push(currentPageDepts);
          currentPageDepts = [];
        }
        currentCol = 0;
      }

      let remainingEmployees = [...dept.result];
      while (remainingEmployees.length > 0) {
        const chunk = remainingEmployees.splice(0, maxEmployeesPerColumn);
        currentPageDepts.push({
          ...dept,
          result: chunk,
        });
        currentCol++;
      }
    });

    if (currentPageDepts.length > 0) {
      result.push(currentPageDepts);
    }

    return result;
  }, [filteredDepartmentData]);

  const handleOpenModal = () => setModalOpen(true);
  const handleCloseModal = () => setModalOpen(false);

  const renderTableContent = () => {
    const currentData = pages[currentPage - 1] || [];
    const isLastPage = currentPage === pages.length;
    const totalColumns = isLastPage && currentData.length < maxColumnsPerPage ? maxColumnsPerPage : currentData.length;
    const columnWidth = `${100 / totalColumns}%`;

    return Array.from({ length: maxEmployeesPerColumn }, (_, rowIndex) => (
      <TableRow key={rowIndex}>
        {currentData.map((dept, colIndex) => {
          const employee = dept.result[rowIndex];
          return (
            <StyledTableCell key={`${colIndex}-${rowIndex}`} sx={{ width: columnWidth }}>
              {employee ? (
                <EmployeeCell status={employee.status}>
                  {formatName(employee)}
                </EmployeeCell>
              ) : (
                <EmployeeCell status={null}>-</EmployeeCell>
              )}
            </StyledTableCell>
          );
        })}
        {isLastPage &&
          currentData.length < maxColumnsPerPage &&
          Array.from({ length: maxColumnsPerPage - currentData.length }).map((_, emptyIndex) => (
            <StyledTableCell key={`empty-${emptyIndex}`} sx={{ width: columnWidth }}>
              <EmployeeCell status={null}>-</EmployeeCell>
            </StyledTableCell>
          ))}
      </TableRow>
    ));
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <Button
        variant="contained"
        onClick={handleOpenModal}
        sx={{
          mb: 2,
          backgroundColor: '#105E82',
          '&:hover': {
            backgroundColor: '#0D4D6B',
          },
        }}
      >
        部門を選択
      </Button>
      <Modal open={modalOpen} onClose={handleCloseModal}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400,
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" component="h2" gutterBottom>
            部門の選択
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <StyledCheckbox
                  checked={isAllSelected}
                  indeterminate={selectedDepartments.size > 0 && !isAllSelected}
                  onChange={handleSelectAll}
                />
              }
              label="All"
            />
            <Divider sx={{ my: 1 }} />
            {departmentData.map((dept) => (
              <FormControlLabel
                key={dept.department_name}
                control={
                  <StyledCheckbox
                    checked={selectedDepartments.has(dept.department_name)}
                    onChange={() => handleDepartmentToggle(dept.department_name)}
                  />
                }
                label={`${dept.department_name} (${dept.display_number})`}
              />
            ))}
          </FormGroup>
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <StyledButton variant="outlined" onClick={handleReset} sx={{ flex: 1 }}>
              Reset
            </StyledButton>
            <Button
              variant="contained"
              onClick={handleCloseModal}
              sx={{
                flex: 1,
                backgroundColor: '#105E82',
                '&:hover': {
                  backgroundColor: '#0D4D6B',
                },
              }}
            >
              閉じる
            </Button>
          </Stack>
        </Box>
      </Modal>
      <TableContainer component={Paper} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Table>
          <TableHead>
            <TableRow>
              {pages[currentPage - 1]?.map((dept, index) => (
                <StyledTableCell key={index}>
                  <strong>{dept.department_name}</strong>
                </StyledTableCell>
              ))}
              {currentPage === pages.length &&
                pages[currentPage - 1]?.length < maxColumnsPerPage &&
                Array.from({ length: maxColumnsPerPage - (pages[currentPage - 1]?.length || 0) }).map((_, emptyIndex) => (
                  <StyledTableCell key={`empty-header-${emptyIndex}`}>
                    <strong>-</strong>
                  </StyledTableCell>
                ))}
            </TableRow>
          </TableHead>
          <TableBody>{renderTableContent()}</TableBody>
        </Table>
      </TableContainer>

      <PaginationContainer>
        <StyledButtonGroup variant="outlined" size="large">
          <Button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <NavigateBeforeIcon />
          </Button>
          <Button disabled sx={{ pointerEvents: 'none' }}>
            <PageIndicator>
              {currentPage} / {pages.length}
            </PageIndicator>
          </Button>
          <Button
            onClick={() => setCurrentPage((prev) => Math.min(pages.length, prev + 1))}
            disabled={currentPage === pages.length}
          >
            <NavigateNextIcon />
          </Button>
        </StyledButtonGroup>
      </PaginationContainer>
    </div>
  );
};

export default NewDepartmentTable;