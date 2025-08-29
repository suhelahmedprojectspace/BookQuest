import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint {
  factor: string
  score: number
  color?: string
}

interface RecommendationChartProps {
  data: DataPoint[]
}

export default function RecommendationChart({ data }: RecommendationChartProps) {
  return (
    <div className="w-full h-64 bg-gray-800/30 p-4 rounded-xl border border-gray-700">
      <h4 className="text-lg font-semibold text-white mb-4 text-center">
        Recommendation Factors
      </h4>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis 
            type="number" 
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <YAxis 
            dataKey="factor" 
            type="category"
            width={120}
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
          />
          <Tooltip 
            formatter={(value: number) => [`${value}%`, 'Confidence']}
            labelStyle={{ color: '#1F2937' }}
            contentStyle={{
              backgroundColor: '#374151',
              border: '1px solid #4B5563',
              borderRadius: '8px',
              color: '#F9FAFB'
            }}
          />
          <Bar 
            dataKey="score" 
            fill="#8B5CF6"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
