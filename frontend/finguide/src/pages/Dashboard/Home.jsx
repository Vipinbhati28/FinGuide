import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { useUserAuth } from '../../hooks/useUserAuth';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import InfoCard from '../../components/Cards/InfoCard';
import RecentTransactions from '../../components/Dashboard/RecentTransactions';
import FinanceOverview from '../../components/Dashboard/FinanceOverview';
import ExpenseTransactions from '../../components/Dashboard/ExpenseTransactions';

import { LuHandCoins, LuWalletMinimal } from 'react-icons/lu';
import { IoMdCard } from "react-icons/io";
import { addThousandsSeparator } from '../../utils/helper';
import Last30DaysExpenses from '../../components/Dashboard/Last30DaysExpenses';
import IncomeTransactions from '../../components/Dashboard/IncomeTransactions';

const Home = () => {
  useUserAuth();
  
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchDashboardData = async () => {
    if (loading) return;

    setLoading(true);

    try {
      const response = await axiosInstance.get(
        `${API_PATHS.DASHBOARD.GET_DATA}`
      );

      if(response.data) {
        setDashboardData(response.data);
      }
    } catch (error) {
      console.log("Something went wrong. Please try again.", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    return () => {};
  }, []);

  const left = dashboardData?.budget?.left ?? 0;
  const leftColor = left < 0 ? 'bg-red-500' : 'bg-emerald-500';

  return (
    <DashboardLayout activeMenu="Dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <InfoCard
            icon = {<IoMdCard />}
            label="Total Balance"
            value={addThousandsSeparator(dashboardData?.totalBalance || 0)}
            color="bg-primary"
          />

          <InfoCard
            icon = {<LuWalletMinimal />}
            label="Total Income"
            value={addThousandsSeparator(dashboardData?.totalIncome || 0)}
            color="bg-orange-500"
          />

          <InfoCard
            icon = {<LuHandCoins />}
            label="Total Expense"
            value={addThousandsSeparator(dashboardData?.totalExpense || 0)}
            color="bg-red-500"
          />

          <InfoCard
            icon = {<IoMdCard />}
            label="Left (30d Budget)"
            value={addThousandsSeparator(left)}
            color={leftColor}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
          <RecentTransactions
            transactions = {dashboardData?.recentTransactions}
            onSeeMore={() => navigate("/expense?range=30d")}
          />

          <FinanceOverview
            totalBalance={dashboardData?.totalBalance || 0}
            totalIncome={dashboardData?.totalIncome || 0}
            totalExpense={dashboardData?.totalExpense || 0}
          /> 

          <ExpenseTransactions
            transactions={dashboardData?.last30DaysExpenses?.transactions || []}
            onSeeMore={() => navigate("/expense?range=30d")}
          />

          <IncomeTransactions
            transactions={dashboardData?.last60DaysIncome?.transactions || []}
            onSeeMore={() => navigate("/income?range=30d")}
          />

          <div className="xl:col-span-2">
            <Last30DaysExpenses
              data={dashboardData?.last30DaysExpenses?.transactions || []}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Home;