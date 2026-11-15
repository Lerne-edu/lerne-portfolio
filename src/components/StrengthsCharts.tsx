'use client'
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line,
} from 'recharts'

type Props = {
  radar: { skill: string; points: number }[]
  yearly: { year: string; activities: number; wins: number }[]
  trend: Record<string, string | number>[]
  subjects: string[]
}
const COLORS = ['#C1622D', '#5C3D2E', '#8A9B6E', '#D9A441']

export default function StrengthsCharts({ radar, yearly, trend, subjects }: Props) {
  return (
    <div className="grid gap-8">
      <div>
        <h3 className="mb-2 font-medium">Strengths wheel</h3>
        <div className="h-80">
          <ResponsiveContainer>
            <RadarChart data={radar} outerRadius="70%">
              <PolarGrid />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 'auto']} tick={{ fontSize: 10 }} />
              <Radar dataKey="points" stroke="#C1622D" fill="#C1622D" fillOpacity={0.35} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <h3 className="mb-2 font-medium">Year-by-year growth</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={yearly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="activities" name="Activities" fill="#5C3D2E" />
              <Bar dataKey="wins" name="Wins" fill="#C1622D" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {trend.length > 0 && (
        <div>
          <h3 className="mb-2 font-medium">Grand Test subject trend (% of marks)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="test" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                {subjects.map((s, i) => <Line key={s} dataKey={s} stroke={COLORS[i % COLORS.length]} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
